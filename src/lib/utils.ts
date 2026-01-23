// Sistema desenvolvido por Dev Nei
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Combina classes CSS com suporte ao tailwind-merge
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
