// Sistema desenvolvido por Dev Nei
// Utilitário para gerar payload Pix EMVCo e QR Code

// Calcula o CRC16 necessário no padrão EMV
function generateCRC16(str: string): string {
  const polynomial = 0x1021;
  let crc = 0xFFFF;

  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ polynomial;
      } else {
        crc = crc << 1;
      }
    }
  }

  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

// Formata um campo EMV com id e tamanho
function formatEMV(id: string, value: string): string {
  const size = value.length.toString().padStart(2, '0');
  return `${id}${size}${value}`;
}

// Estrutura de dados para gerar o payload Pix
export interface PixPayload {
  chavePix: string;
  nomeRecebedor: string;
  cidade: string;
  valor: number;
  txid?: string;
}

// Monta o payload Pix no formato EMVCo
export function generatePixPayload(payload: PixPayload): string {
  const {
    chavePix,
    nomeRecebedor,
    cidade,
    valor,
    txid = `BARBER${Date.now().toString().slice(-8)}`
  } = payload;

  // EMVCo Pix format
  let pixString = '';
  
  // Payload Format Indicator
  pixString += formatEMV('00', '01');
  
  // Merchant Account Information (Pix)
  const merchantInfo = 
    formatEMV('00', 'BR.GOV.BCB.PIX') +
    formatEMV('01', chavePix) +
    (txid ? formatEMV('02', txid) : '');
  pixString += formatEMV('26', merchantInfo);
  
  // Merchant Category Code
  pixString += formatEMV('52', '0000');
  
  // Transaction Currency (BRL)
  pixString += formatEMV('53', '986');
  
  // Transaction Amount
  if (valor > 0) {
    pixString += formatEMV('54', valor.toFixed(2));
  }
  
  // Country Code
  pixString += formatEMV('58', 'BR');
  
  // Merchant Name
  pixString += formatEMV('59', nomeRecebedor.slice(0, 25));
  
  // Merchant City
  pixString += formatEMV('60', cidade.slice(0, 15));
  
  // Additional Data Field
  const additionalData = formatEMV('05', txid);
  pixString += formatEMV('62', additionalData);
  
  // CRC16
  pixString += '6304';
  const crc = generateCRC16(pixString);
  pixString += crc;

  return pixString;
}

// Gera QR Code a partir do payload Pix
export async function generatePixQRCode(pixPayload: string): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(pixPayload, {
    errorCorrectionLevel: 'M',
    width: 300,
    margin: 2,
  });
}
