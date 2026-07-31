export function detectModule(message: string): string {
  const text = message.toLowerCase();

  if (
    text.includes("study") ||
    text.includes("exam") ||
    text.includes("college") ||
    text.includes("education")
  ) {
    return "education";
  }

  if (
    text.includes("hospital") ||
    text.includes("doctor") ||
    text.includes("medicine") ||
    text.includes("health")
  ) {
    return "healthcare";
  }

  if (
    text.includes("government") ||
    text.includes("scheme") ||
    text.includes("aadhaar") ||
    text.includes("pan")
  ) {
    return "government";
  }

  if (
    text.includes("crop") ||
    text.includes("farmer") ||
    text.includes("agriculture")
  ) {
    return "agriculture";
  }

  if (
    text.includes("money") ||
    text.includes("loan") ||
    text.includes("investment") ||
    text.includes("finance")
  ) {
    return "finance";
  }

  return "general";
}
