import type { AppConfig } from "~/lib/config.server";
import type { AiInput, AiOutput } from "./types";

export class OpenRouterVisualClassifier {
  private enabled = false;

  constructor(private readonly config: AppConfig) {}

  async initialize() {
    if (!this.config.OPENROUTER_API_KEY) {
      console.warn("OpenRouter API key not configured; AI visual review disabled.");
      return;
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${this.config.OPENROUTER_API_KEY}` },
      });
      if (!response.ok) throw new Error(`Model list failed: ${response.status}`);
      const data = (await response.json()) as { data?: Array<Record<string, unknown> & { id?: string }> };
      const model = data.data?.find((item) => item.id === this.config.OPENROUTER_MODEL);
      const modelText = JSON.stringify(model ?? {}).toLowerCase();
      const explicitlyTextOnly = modelText.includes("text") && !/(image|vision|multimodal)/i.test(modelText);

      if (!model) {
        console.warn(`OpenRouter model ${this.config.OPENROUTER_MODEL} not found; AI visual review disabled.`);
        return;
      }

      if (explicitlyTextOnly) {
        console.warn(`OpenRouter model ${this.config.OPENROUTER_MODEL} does not appear to support image input; AI visual review disabled.`);
        return;
      }

      this.enabled = true;
      console.log(`AI visual review enabled with OpenRouter model ${this.config.OPENROUTER_MODEL}`);
    } catch (error) {
      console.warn("Could not validate OpenRouter model; AI visual review disabled.", error);
    }
  }

  isEnabled() {
    return this.enabled;
  }

  async classify(input: AiInput): Promise<AiOutput | null> {
    if (!this.enabled || !this.config.OPENROUTER_API_KEY) return null;

    const image = input.screenshot.toString("base64");
    const prompt = `Classify this mobile viewport screenshot for a website monitor. Be conservative. Return VISUAL_BROKEN only if the page is clearly unusable or severely malformed. If uncertain, return OK with low confidence.\n\nMetadata:\nhost: ${input.urlHost}\nhttp_status: ${input.httpStatus ?? "unknown"}\ntitle: ${input.pageTitle.slice(0, 120)}\nvisible_text_sample: ${input.visibleTextSample.slice(0, 300)}\nsuspicion_signals: ${input.suspicionSignals.join(", ") || "none"}\n\nReturn strict JSON with keys classification, confidence, reason.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://website-visual-monitoring.local",
        "X-Title": "Website Visual Monitoring",
      },
      body: JSON.stringify({
        model: this.config.OPENROUTER_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } },
            ],
          },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.warn(`OpenRouter classification failed: ${response.status} ${await response.text()}`);
      return null;
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";
    return parseAiOutput(content);
  }
}

function parseAiOutput(content: string): AiOutput | null {
  const jsonText = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
  try {
    const parsed = JSON.parse(jsonText) as AiOutput;
    if (!["OK", "VISUAL_BROKEN", "ERROR_PAGE", "BLANK"].includes(parsed.classification)) return null;
    return {
      classification: parsed.classification,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      reason: String(parsed.reason ?? "AI classification completed.").slice(0, 240),
    };
  } catch {
    return null;
  }
}
