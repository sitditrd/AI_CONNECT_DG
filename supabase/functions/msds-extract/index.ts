// Connect DG — 위험물 문서 분석 Edge Function (Claude API)
// PDF/이미지 문서를 Claude 문서 이해로 구조화한다. 문서 유형(doc_type)마다 출력 스키마만 바꾼다.
//   · msds (기본) — 표준 위험물 프로파일
//   · bl          — B/L(선하증권) · 위험물 신고 행 — 양식이 통일되지 않은 비정형 문서
// 두 유형 모두 문서 특성(docMeta: 언어 · 형식 · 스캔 품질)을 함께 판독해, 저품질 · 미검증 언어는
// 클라이언트에서 담당자 확인으로 전환한다.
// 배포: supabase functions deploy msds-extract --no-verify-jwt
// 시크릿: ANTHROPIC_API_KEY (필수) · SUPABASE_URL/SERVICE_ROLE_KEY는 자동 주입
// 인증: 요청 body의 token(dg_sessions)을 검증 — 승인 계정만 실분석 허용(API 비용 보호)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const MAX_BYTES = 8 * 1024 * 1024; // base64 이전 원본 기준 8MB
const MEDIA_OK = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// 문서 특성 — 양식 · 언어 · 스캔 품질 차이에 대한 처리 근거
const DOC_META_SCHEMA = {
  type: "object",
  properties: {
    language: { type: "string", enum: ["ko", "en", "zh", "ja", "other"], description: "Main language of the document body" },
    layout: { type: "string", enum: ["text-pdf", "scanned", "photo", "mixed"], description: "text-pdf if a text layer exists, scanned/photo if image only" },
    scanQuality: { type: "string", enum: ["high", "medium", "low"], description: "Legibility of the source; low if values are blurred, skewed or cut off" },
    format: { type: "string", description: "Document format, e.g. 'GHS 16 sections', 'Korean MSDS (OSH Act Art.110)', 'non-standard'" },
    origin: { type: "string", description: "Issuer/manufacturer country or edition if stated, else empty" },
  },
  required: ["language", "layout", "scanQuality", "format", "origin"],
  additionalProperties: false,
};

// 추출값 원문 위치 — 모든 문서 유형 공통
const EXTRACTION_SCHEMA = {
  type: "array",
  description: "Per-field provenance for the audit table",
  items: {
    type: "object",
    properties: {
      field: { type: "string" },
      value: { type: "string", description: "Extracted value as displayed" },
      section: { type: "string", description: "Section or block where found" },
      page: { type: "integer", description: "1-based page number where found; 0 if unknown" },
      confidence: { type: "number", description: "0-1 extraction confidence" },
    },
    required: ["field", "value", "section", "page", "confidence"],
    additionalProperties: false,
  },
};

// B/L(선하증권) 스키마 — 발행사마다 양식이 다른 비정형 문서. 위험물 신고 행을 구조화한다.
const BL_SCHEMA = {
  type: "object",
  properties: {
    blNo: { type: "string" },
    shipper: { type: "string" },
    consignee: { type: "string" },
    notifyParty: { type: "string" },
    vessel: { type: "string" },
    voyage: { type: "string" },
    portOfLoading: { type: "string" },
    portOfDischarge: { type: "string" },
    containers: {
      type: "array",
      items: {
        type: "object",
        properties: { no: { type: "string" }, type: { type: "string" }, seal: { type: "string" } },
        required: ["no", "type", "seal"],
        additionalProperties: false,
      },
    },
    goods: {
      type: "array",
      description: "Cargo lines. For dangerous goods, transcribe UN/class/PG exactly as printed; empty strings when absent",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          unNo: { type: "string" },
          psn: { type: "string" },
          hazardClass: { type: "string" },
          packingGroup: { type: "string" },
          marinePollutant: { type: "boolean" },
          packages: { type: "string" },
          grossWeightKg: { type: "string" },
        },
        required: ["description", "unNo", "psn", "hazardClass", "packingGroup", "marinePollutant", "packages", "grossWeightKg"],
        additionalProperties: false,
      },
    },
    docMeta: DOC_META_SCHEMA,
    extraction: EXTRACTION_SCHEMA,
  },
  required: ["blNo", "shipper", "consignee", "notifyParty", "vessel", "voyage", "portOfLoading", "portOfDischarge",
    "containers", "goods", "docMeta", "extraction"],
  additionalProperties: false,
};

// 표준 위험물 프로파일 스키마 — msds.js 데모 프로파일과 동일 구조
const PROFILE_SCHEMA = {
  type: "object",
  properties: {
    productName: { type: "string", description: "Product name from MSDS Section 1/3" },
    casNo: { type: "array", items: { type: "string" }, description: "CAS numbers of main components" },
    components: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          cas: { type: "string" },
          pct: { type: "string", description: "Concentration/range as printed, e.g. '30-60%'" },
        },
        required: ["name", "cas", "pct"],
        additionalProperties: false,
      },
    },
    unNo: { type: "string", description: "UN number, e.g. 'UN 1866'. Empty string if not regulated." },
    psn: { type: "string", description: "Proper Shipping Name" },
    hazardClass: { type: "string", description: "Transport hazard class, e.g. '3' or '9'" },
    subRisk: { type: "string", description: "Subsidiary risk class or empty string" },
    packingGroup: { type: "string", description: "Packing group I/II/III, or empty string (e.g. lithium batteries)" },
    marinePollutant: { type: "boolean" },
    tunnelCode: { type: "string", description: "ADR tunnel restriction code, e.g. '(D/E)'. Empty if absent." },
    flashPointC: { type: "string", description: "Flash point in Celsius as printed, or empty" },
    storageTemp: { type: "string", description: "Recommended storage temperature/condition, or empty" },
    incompatible: { type: "array", items: { type: "string" }, description: "Incompatible materials (Section 10)" },
    specialProvisions: { type: "array", items: { type: "string" }, description: "Special provision numbers only if printed; do not infer" },
    docMeta: DOC_META_SCHEMA,
    extraction: {
      type: "array",
      description: "Per-field provenance for the audit table",
      items: {
        type: "object",
        properties: {
          field: { type: "string", description: "One of: productName, casNo, components, unNo, psn, hazardClass, packingGroup, marinePollutant, specialProvisions" },
          value: { type: "string", description: "Extracted value as displayed" },
          section: { type: "string", description: "MSDS section, e.g. 'Section 14'" },
          page: { type: "integer", description: "1-based page number where found; 0 if unknown" },
          confidence: { type: "number", description: "0-1 extraction confidence" },
        },
        required: ["field", "value", "section", "page", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["productName", "casNo", "components", "unNo", "psn", "hazardClass", "subRisk",
    "packingGroup", "marinePollutant", "tunnelCode", "flashPointC", "storageTemp",
    "incompatible", "specialProvisions", "docMeta", "extraction"],
  additionalProperties: false,
};

// 문서 유형별 스키마 · 지시문 — 새 유형은 여기에 한 항목만 추가하면 된다
const DOC_TYPES: Record<string, { schema: unknown; system: string; prompt: string }> = {
  msds: {
    schema: PROFILE_SCHEMA,
    system:
      "You are a dangerous-goods logistics document analyst. Extract a standard dangerous goods profile " +
      "from the attached MSDS/SDS document. Focus on Section 1 (identification), Section 3 (composition), " +
      "Section 9/10 (flash point, storage, incompatibilities) and Section 14 (transport information). " +
      "Values must be transcribed exactly as printed (do not infer UN numbers or classes that are not in the document; " +
      "use empty strings when a field is genuinely absent). Report page numbers from the PDF page index. " +
      "Assess docMeta (language, layout, scan quality) from the document itself. " +
      "Confidence reflects OCR/print quality and ambiguity.",
    prompt: "Extract the standard dangerous goods profile from this MSDS",
  },
  bl: {
    schema: BL_SCHEMA,
    system:
      "You are a shipping document analyst. The attached document is a Bill of Lading whose layout differs by issuer. " +
      "Extract parties, vessel/voyage, ports, containers and every cargo line. For dangerous goods lines, transcribe " +
      "UN number, proper shipping name, class and packing group exactly as printed; never infer missing values. " +
      "Report page numbers from the PDF page index and assess docMeta (language, layout, scan quality).",
    prompt: "Extract the bill of lading data and dangerous goods lines from this document",
  },
};

async function validToken(token: string): Promise<boolean> {
  if (!token) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/dg_me`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }),
  });
  if (!r.ok) return false;
  const me = await r.json();
  // status까지 확인 — 승인 취소된 계정의 잔여 토큰으로 유료 분석이 호출되지 않도록
  return !!(me && me.ok && me.status === "approved");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ error: "method" }, 405);
  try {
    const body = await req.json();

    // 능력 조사(probe) — 클라이언트가 'AI 분석이 가능한 서버인지'만 확인한다.
    // Anthropic API 를 호출하지 않으므로 과금 0. 키 값은 절대 내려보내지 않고 유무만 반환.
    // 인증도 요구하지 않아 로그인 전에도 정확한 엔진 상태를 표시할 수 있다.
    if (body && body.probe === true) {
      return j({ ok: true, ai: !!ANTHROPIC_KEY, maxBytes: MAX_BYTES, mediaTypes: MEDIA_OK, docTypes: Object.keys(DOC_TYPES) });
    }

    if (!ANTHROPIC_KEY) return j({ error: "ANTHROPIC_API_KEY not configured", code: "no_api_key" }, 503);

    const { token, filename, media_type, data } = body;
    const docType = String(body.doc_type ?? "msds");
    const spec = DOC_TYPES[docType];
    if (!spec) return j({ error: "unsupported doc_type", docTypes: Object.keys(DOC_TYPES) }, 400);
    if (!(await validToken(String(token ?? "")))) return j({ error: "로그인이 필요합니다" }, 401);
    if (!MEDIA_OK.includes(media_type)) return j({ error: "unsupported media type" }, 400);
    const b64 = String(data ?? "");
    if (!b64 || b64.length * 0.75 > MAX_BYTES) return j({ error: "file too large (max 8MB)" }, 413);

    const isPdf = media_type === "application/pdf";
    const docBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
      : { type: "image", source: { type: "base64", media_type, data: b64 } };

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-5",
        max_tokens: 16000,
        system: spec.system,
        messages: [{
          role: "user",
          content: [
            docBlock,
            { type: "text", text: `${spec.prompt} (file: ${String(filename ?? "upload")}).` },
          ],
        }],
        // effort medium — claude-opus-5는 thinking이 기본 ON이고 max_tokens를 응답과 공유한다.
        // 기본(high)에서는 다페이지·저품질 스캔 MSDS에서 출력이 잘려 JSON 파싱이 실패할 수 있다.
        output_config: { format: { type: "json_schema", schema: spec.schema }, effort: "medium" },
      }),
    });

    const out = await anthropicRes.json();
    if (!anthropicRes.ok) {
      return j({ error: `analysis failed: ${out?.error?.message ?? anthropicRes.status}` }, 502);
    }
    if (out.stop_reason === "refusal") return j({ error: "analysis declined by safety system" }, 422);
    // 출력 잘림 — 구조화 JSON이 미완성이므로 파싱 실패로 넘기지 않고 원인을 그대로 알린다
    if (out.stop_reason === "max_tokens") {
      return j({ error: "분석 출력이 잘렸습니다 — 문서가 너무 크거나 복잡합니다(페이지를 줄여 다시 시도)" }, 422);
    }

    const textBlock = (out.content ?? []).find((b: { type: string }) => b.type === "text");
    if (!textBlock?.text) return j({ error: "empty analysis result" }, 502);

    let profile;
    try { profile = JSON.parse(textBlock.text); }
    catch { return j({ error: "analysis result parse failed" }, 502); }

    return j({ ok: true, docType, profile, model: out.model, usage: out.usage });
  } catch (e) {
    return j({ error: String(e) }, 500);
  }
});
