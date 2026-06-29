# Use OpenRouter for AI visual review

We will use OpenRouter as the AI provider for fallback visual classification, with `google/gemma-4-26b-a4b-it` as the preferred configured model. The app must validate that the configured model supports image input and disable AI visual review with a clear configuration error if it does not, because visual classification depends on ephemeral screenshot input and silent text-only fallback would be misleading.
