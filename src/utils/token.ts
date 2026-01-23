// Sistema desenvolvido por Dev Nei
// Utilitário para geração e validação de tokens JWT simples

// Gera um token de agendamento com validade de 48 horas
export function generateBookingToken(bookingId: string): string {
  const payload = {
    bookingId,
    exp: Date.now() + 48 * 60 * 60 * 1000 // 48 horas
  };
  
  // Token simples baseado em base64 (para MVP)
  // Em produção, use JWT adequado com secret
  return btoa(JSON.stringify(payload));
}

// Valida o token e retorna o status e o id do agendamento
export function validateToken(token: string): { valid: boolean; bookingId?: string } {
  try {
    const decoded = JSON.parse(atob(token));
    
    if (decoded.exp < Date.now()) {
      return { valid: false };
    }
    
    return { valid: true, bookingId: decoded.bookingId };
  } catch {
    return { valid: false };
  }
}
