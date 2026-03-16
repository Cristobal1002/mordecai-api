import { logger } from "../../utils/logger.js";
import { saveElevenPostCallPayload } from "../twilio/twilio.storage.js";
import { normalizeElevenPostCallPayload } from "./eleven.mapper.js";
import {
  createPaymentAgreementFromTool,
  createDisputeFromTool,
  getCallStateSnapshot,
  syncInteractionFromPostCall,
} from "./eleven.service.js";
import { orchestrateCallStepFromTool } from "./call-orchestrator.service.js";
import { verifyElevenLabsWebhook } from "./eleven.webhook.js";

const getWebhookSignatureHeader = (req) =>
  req.get("ElevenLabs-Signature") || req.get("elevenlabs-signature") || "";

const getRawBody = (req) =>
  req.rawBody || Buffer.from(JSON.stringify(req.body || {}));

const parseToolPayload = (body) => {
  if (!body || typeof body !== "object") return {};

  const conversationId =
    body.conversation_id ||
    body.conversationId ||
    body?.data?.conversation_id ||
    null;

  const candidate =
    body.arguments ||
    body.input ||
    body.params ||
    body?.data?.tool_call?.arguments ||
    body?.data?.arguments ||
    body;
  const proposal = candidate.proposal || candidate;

  return {
    conversationId,
    tenantId: candidate.tenant_id || candidate.tenantId || null,
    caseId: candidate.case_id || candidate.caseId || null,
    interactionId: candidate.interaction_id || candidate.interactionId || null,
    automationId:
      candidate.automation_id ||
      candidate.automationId ||
      proposal?.automation_id ||
      proposal?.automationId ||
      null,
    proposal,
  };
};

const parseOrchestratorPayload = (body) => {
  const parsed = parseToolPayload(body);
  const candidate = parsed.proposal || {};
  const pickDefinedValue = (...values) => {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return null;
  };
  const compactObject = (value) =>
    Object.entries(value).reduce((result, [key, fieldValue]) => {
      if (fieldValue === undefined || fieldValue === null || fieldValue === "") {
        return result;
      }
      result[key] = fieldValue;
      return result;
    }, {});
  const topLevelEntities = compactObject({
    action: pickDefinedValue(candidate.action, body?.action),
    confidence: pickDefinedValue(candidate.confidence, body?.confidence),
    plan_type: pickDefinedValue(
      candidate.plan_type,
      candidate.planType,
      body?.plan_type,
      body?.planType,
    ),
    upfront_amount_cents: pickDefinedValue(
      candidate.upfront_amount_cents,
      candidate.upfrontAmountCents,
      candidate.upfront_amount,
      body?.upfront_amount_cents,
      body?.upfrontAmountCents,
      body?.upfront_amount,
    ),
    installments_count: pickDefinedValue(
      candidate.installments_count,
      candidate.installmentsCount,
      body?.installments_count,
      body?.installmentsCount,
    ),
    delivery_channel: pickDefinedValue(
      candidate.delivery_channel,
      candidate.deliveryChannel,
      candidate.channel,
      body?.delivery_channel,
      body?.deliveryChannel,
      body?.channel,
    ),
    delivery_email: pickDefinedValue(
      candidate.delivery_email,
      candidate.deliveryEmail,
      candidate.email,
      body?.delivery_email,
      body?.deliveryEmail,
      body?.email,
    ),
    dispute_reason: pickDefinedValue(
      candidate.dispute_reason,
      candidate.disputeReason,
      candidate.reason,
      body?.dispute_reason,
      body?.disputeReason,
      body?.reason,
    ),
    identity_verified: pickDefinedValue(
      candidate.identity_verified,
      candidate.identityVerified,
      body?.identity_verified,
      body?.identityVerified,
    ),
    agreement_confirmed: pickDefinedValue(
      candidate.agreement_confirmed,
      candidate.agreementConfirmed,
      body?.agreement_confirmed,
      body?.agreementConfirmed,
    ),
    callback_requested: pickDefinedValue(
      candidate.callback_requested,
      candidate.callbackRequested,
      body?.callback_requested,
      body?.callbackRequested,
    ),
    goodbye: pickDefinedValue(candidate.goodbye, body?.goodbye),
  });
  const payloadEntities = {
    ...(candidate.entities && typeof candidate.entities === "object"
      ? candidate.entities
      : {}),
    ...(candidate.slots && typeof candidate.slots === "object"
      ? candidate.slots
      : {}),
    ...topLevelEntities,
  };

  return {
    conversationId: parsed.conversationId,
    tenantId: parsed.tenantId,
    caseId: parsed.caseId,
    interactionId: parsed.interactionId,
    currentState:
      candidate.current_state ||
      candidate.currentState ||
      body?.current_state ||
      body?.currentState ||
      null,
    userUtterance:
      candidate.user_utterance ||
      candidate.userUtterance ||
      candidate.last_user_message ||
      candidate.message ||
      body?.user_utterance ||
      body?.userUtterance ||
      body?.message ||
      "",
    intentHint:
      candidate.intent ||
      candidate.intent_hint ||
      body?.intent ||
      body?.intent_hint ||
      null,
    entities: payloadEntities,
  };
};

const verifyToolSecret = (req) => {
  const expectedToolSecret = process.env.ELEVENLABS_TOOL_SECRET;
  const providedToolSecret =
    req.get("x-eleven-tool-secret") || req.get("x-tool-secret");
  if (expectedToolSecret && expectedToolSecret !== providedToolSecret) {
    return { ok: false, hasSecret: Boolean(providedToolSecret) };
  }
  return { ok: true };
};

export const elevenController = {
  postCall: async (req, res) => {
    const signatureHeader = getWebhookSignatureHeader(req);
    const toleranceSeconds =
      Number(process.env.ELEVENLABS_WEBHOOK_TOLERANCE_SEC) ||
      Number(process.env.ELEVENLABS_WEBHOOK_TOLERANCE_SECONDS) ||
      1800;

    const verification = verifyElevenLabsWebhook({
      signatureHeader,
      rawBody: getRawBody(req),
      secret: process.env.ELEVENLABS_WEBHOOK_SECRET,
      toleranceSeconds,
    });

    if (!verification.valid) {
      logger.warn(
        {
          reason: verification.reason,
          hasSignatureHeader: Boolean(signatureHeader),
        },
        "Rejected ElevenLabs post-call webhook",
      );
      return res.status(401).json({
        success: false,
        message: "Invalid ElevenLabs webhook signature",
      });
    }

    const normalizedPayload = normalizeElevenPostCallPayload(req.body);
    logger.info(
      {
        event: normalizedPayload.event,
        conversationId: normalizedPayload.conversationId,
        callSid: normalizedPayload.callSid,
        interactionId: normalizedPayload.interactionId,
        callDurationSecs: normalizedPayload.callDurationSecs,
        terminationReason: normalizedPayload.terminationReason,
      },
      "Accepted ElevenLabs post-call webhook",
    );

    let s3Key = null;
    try {
      s3Key = await saveElevenPostCallPayload(normalizedPayload);
    } catch (error) {
      logger.error(
        { error },
        "Failed to save ElevenLabs post-call payload to S3",
      );
    }

    try {
      await syncInteractionFromPostCall({ normalizedPayload, s3Key });
    } catch (error) {
      logger.error({ error }, "Failed to sync post-call payload to DB");
    }

    return res.status(200).json({
      success: true,
      conversationId: normalizedPayload.conversationId,
      s3Key,
    });
  },

  createPaymentAgreementTool: async (req, res) => {
    const toolSecretValidation = verifyToolSecret(req);
    if (!toolSecretValidation.ok) {
      logger.warn(
        { hasSecret: toolSecretValidation.hasSecret },
        "Rejected ElevenLabs create-payment-agreement tool call (invalid secret)",
      );
      return res.status(401).json({
        ok: false,
        code: "INVALID_TOOL_SECRET",
        message: "Invalid tool secret.",
      });
    }

    const parsedPayload = parseToolPayload(req.body);
    logger.info(
      {
        conversationId: parsedPayload.conversationId,
        tenantId: parsedPayload.tenantId,
        caseId: parsedPayload.caseId,
        interactionId: parsedPayload.interactionId,
        automationId: parsedPayload.automationId,
        hasProposal: Boolean(parsedPayload.proposal),
        planType:
          parsedPayload.proposal?.plan_type ||
          parsedPayload.proposal?.planType ||
          null,
        deliveryChannel:
          parsedPayload.proposal?.delivery_channel ||
          parsedPayload.proposal?.deliveryChannel ||
          null,
        upfrontAmountCents:
          parsedPayload.proposal?.upfront_amount_cents ||
          parsedPayload.proposal?.upfrontAmountCents ||
          null,
        installmentsCount:
          parsedPayload.proposal?.installments_count ||
          parsedPayload.proposal?.installmentsCount ||
          null,
      },
      "Incoming ElevenLabs create-payment-agreement tool call",
    );
    if (
      !parsedPayload.tenantId ||
      !parsedPayload.caseId ||
      !parsedPayload.proposal
    ) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "Missing tenant_id, case_id or proposal in tool payload.",
      });
    }

    const result = await createPaymentAgreementFromTool(parsedPayload);
    logger.info(
      {
        ok: result?.ok === true,
        code: result?.code || null,
        agreementId: result?.agreement_id || null,
        caseStatus: result?.case_status || null,
        emailSent: result?.email_sent === true,
        smsSent: result?.sms_sent === true,
      },
      "Completed ElevenLabs create-payment-agreement tool call",
    );
    return res.status(200).json(result);
  },

  createDisputeTool: async (req, res) => {
    const toolSecretValidation = verifyToolSecret(req);
    if (!toolSecretValidation.ok) {
      logger.warn(
        { hasSecret: toolSecretValidation.hasSecret },
        "Rejected ElevenLabs create-dispute tool call (invalid secret)",
      );
      return res.status(401).json({
        ok: false,
        code: "INVALID_TOOL_SECRET",
        message: "Invalid tool secret.",
      });
    }

    const parsedPayload = parseToolPayload(req.body);
    logger.info(
      {
        conversationId: parsedPayload.conversationId,
        tenantId: parsedPayload.tenantId,
        caseId: parsedPayload.caseId,
        interactionId: parsedPayload.interactionId,
        automationId: parsedPayload.automationId,
        hasProposal: Boolean(parsedPayload.proposal),
        reason:
          parsedPayload.proposal?.reason ||
          parsedPayload.proposal?.dispute_reason ||
          null,
      },
      "Incoming ElevenLabs create-dispute tool call",
    );

    if (
      !parsedPayload.tenantId ||
      !parsedPayload.caseId ||
      !parsedPayload.proposal
    ) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "Missing tenant_id, case_id or proposal in tool payload.",
      });
    }

    const result = await createDisputeFromTool(parsedPayload);
    logger.info(
      {
        ok: result?.ok === true,
        code: result?.code || null,
        disputeId: result?.dispute_id || null,
      },
      "Completed ElevenLabs create-dispute tool call",
    );
    return res.status(200).json(result);
  },

  orchestrateCallStepTool: async (req, res) => {
    const toolSecretValidation = verifyToolSecret(req);
    if (!toolSecretValidation.ok) {
      logger.warn(
        { hasSecret: toolSecretValidation.hasSecret },
        "Rejected ElevenLabs orchestrate-call-step tool call (invalid secret)",
      );
      return res.status(401).json({
        ok: false,
        code: "INVALID_TOOL_SECRET",
        message: "Invalid tool secret.",
      });
    }

    const payload = parseOrchestratorPayload(req.body);
    logger.info(
      {
        conversationId: payload.conversationId,
        tenantId: payload.tenantId,
        caseId: payload.caseId,
        interactionId: payload.interactionId,
        currentState: payload.currentState,
        hasUtterance: Boolean(String(payload.userUtterance || "").trim()),
      },
      "Incoming ElevenLabs orchestrate-call-step tool call",
    );

    if (!payload.tenantId || !payload.caseId) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "Missing tenant_id or case_id in tool payload.",
      });
    }

    const result = await orchestrateCallStepFromTool(payload);
    logger.info(
      {
        ok: result?.ok === true,
        code: result?.code || null,
        currentState: result?.current_state || null,
        nextState: result?.next_state || null,
        action: result?.action || null,
      },
      "Completed ElevenLabs orchestrate-call-step tool call",
    );
    return res.status(200).json(result);
  },

  getCallStateTool: async (req, res) => {
    const toolSecretValidation = verifyToolSecret(req);
    if (!toolSecretValidation.ok) {
      logger.warn(
        { hasSecret: toolSecretValidation.hasSecret },
        "Rejected ElevenLabs get-call-state tool call (invalid secret)",
      );
      return res.status(401).json({
        ok: false,
        code: "INVALID_TOOL_SECRET",
        message: "Invalid tool secret.",
      });
    }

    const tenantId = req.query?.tenant_id || req.query?.tenantId || null;
    const caseId = req.query?.case_id || req.query?.caseId || null;
    const interactionId =
      req.query?.interaction_id || req.query?.interactionId || null;

    if (!tenantId || !caseId) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "Missing tenant_id or case_id query params.",
      });
    }

    const result = await getCallStateSnapshot({
      tenantId,
      caseId,
      interactionId,
    });
    return res.status(200).json(result);
  },
};
