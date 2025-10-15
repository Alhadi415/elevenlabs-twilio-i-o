import Fastify from "fastify";
import dotenv from "dotenv";
import fastifyFormBody from "@fastify/formbody";
import Twilio from "twilio";

// تحميل متغيرات البيئة
dotenv.config();

// إعداد السيرفر
const fastify = Fastify({ logger: true });
fastify.register(fastifyFormBody);

const PORT = process.env.PORT || 8000;

// ✅ Twilio environment variables
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER
} = process.env;

// تأكيد القيم المطلوبة
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  console.error("❌ Missing Twilio environment variables!");
  process.exit(1);
}

// إنشاء عميل Twilio
const twilioClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// 🔹 Route رئيسي للفحص
fastify.get("/", async (_, reply) => {
  reply.send({ message: "🚀 Server is running (ConversationRelay + ElevenLabs)" });
});

// 🔹 Route لبدء المكالمة
fastify.post("/outbound-call", async (request, reply) => {
  try {
    const { number, prompt, greeting } = request.body;

    if (!number) {
      return reply.code(400).send({ error: "Phone number is required" });
    }

    // TwiML endpoint
    const twimlUrl = new URL(`https://${request.headers.host}/outbound-call-twiml`);
    if (prompt) twimlUrl.searchParams.append("prompt", prompt);
    if (greeting) twimlUrl.searchParams.append("greeting", greeting);

    // بدء المكالمة
    const call = await twilioClient.calls.create({
      from: TWILIO_PHONE_NUMBER,
      to: number,
      url: twimlUrl.toString()
    });

    reply.send({
      success: true,
      message: "Call initiated successfully",
      callSid: call.sid
    });
  } catch (err) {
    console.error("❌ Error initiating outbound call:", err);
    reply.code(500).send({ error: "Failed to initiate call" });
  }
});

// 🔹 Route يولّد TwiML الرسمي لـ ConversationRelay + ElevenLabs
fastify.all("/outbound-call-twiml", async (request, reply) => {
  const prompt = request.query.prompt || "مرحبا مؤمل، شلونك؟";
  const greeting = request.query.greeting || "اهلا وسهلا بيك مؤمل!";

  // 🔊 إعدادات ElevenLabs Voice
  // يمكنك تغيير Voice ID من مكتبة ElevenLabs:
  // https://elevenlabs.io/voice-library
  const elevenLabsVoiceId = "ZF6FPAbjXT4488VcRRnw"; // Amelia
  const voiceConfig = `${elevenLabsVoiceId}-flash_v2_5-1.2_1.0_1.0`;

  // 🔧 إنشاء TwiML
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
  <Response>
    <Connect>
      <ConversationRelay 
        ttsProvider="ElevenLabs"
        voice="${voiceConfig}"
        elevenlabsTextNormalization="on"
        welcomeGreeting="${greeting}"
        conversationStartText="${prompt}"
      />
    </Connect>
  </Response>`;

  reply.type("text/xml").send(twimlResponse);
});

// تشغيل السيرفر
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`✅ [Server] Listening on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
