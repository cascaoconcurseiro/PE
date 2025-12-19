/**
 * Logos de bancos brasileiros em SVG inline
 * Logos simplificados para identificação visual
 */

export interface BankInfo {
  code: string;
  name: string;
}

// Lista de bancos brasileiros
export const BRAZILIAN_BANKS: BankInfo[] = [
  { code: 'nubank', name: 'Nubank' },
  { code: 'inter', name: 'Banco Inter' },
  { code: 'c6', name: 'C6 Bank' },
  { code: 'itau', name: 'Itaú' },
  { code: 'bradesco', name: 'Bradesco' },
  { code: 'santander', name: 'Santander' },
  { code: 'caixa', name: 'Caixa' },
  { code: 'bb', name: 'Banco do Brasil' },
  { code: 'neon', name: 'Neon' },
  { code: 'picpay', name: 'PicPay' },
  { code: 'mercadopago', name: 'Mercado Pago' },
  { code: 'pagbank', name: 'PagBank' },
  { code: 'stone', name: 'Stone' },
  { code: 'btg', name: 'BTG Pactual' },
  { code: 'xp', name: 'XP Investimentos' },
  { code: 'safra', name: 'Safra' },
  { code: 'original', name: 'Original' },
  { code: 'sicoob', name: 'Sicoob' },
  { code: 'sicredi', name: 'Sicredi' },
  { code: 'banrisul', name: 'Banrisul' },
  { code: 'bmg', name: 'BMG' },
  { code: 'daycoval', name: 'Daycoval' },
  { code: 'sofisa', name: 'Sofisa' },
  { code: 'unicred', name: 'Unicred' },
  { code: 'will', name: 'Will Bank' },
  { code: 'cora', name: 'Cora' },
  { code: 'ame', name: 'Ame Digital' },
  { code: 'recargapay', name: 'RecargaPay' },
  { code: '99pay', name: '99Pay' },
];

// Lista de bancos/instituições internacionais
export const INTERNATIONAL_BANKS: BankInfo[] = [
  { code: 'wise', name: 'Wise' },
  { code: 'nomad', name: 'Nomad' },
  { code: 'paypal', name: 'PayPal' },
  { code: 'revolut', name: 'Revolut' },
  { code: 'n26', name: 'N26' },
  { code: 'avenue', name: 'Avenue' },
  { code: 'passfolio', name: 'Passfolio' },
  { code: 'remessa', name: 'Remessa Online' },
  { code: 'husky', name: 'Husky' },
  { code: 'bs2', name: 'BS2' },
  { code: 'inter', name: 'Inter Global' },
  { code: 'c6global', name: 'C6 Global' },
];

// SVGs inline dos bancos mais populares (cores oficiais)
const BANK_SVGS: Record<string, string> = {
  // Nubank - Roxo #820AD1
  nubank: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#820AD1"/><path d="M30 65V40c0-5.5 4.5-10 10-10h5c5.5 0 10 4.5 10 10v25M55 35v30c0 5.5 4.5 10 10 10h5c5.5 0 10-4.5 10-10V35" stroke="white" stroke-width="6" stroke-linecap="round"/></svg>`,
  
  // Inter - Laranja #FF7A00
  inter: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#FF7A00"/><circle cx="50" cy="50" r="25" stroke="white" stroke-width="6"/><circle cx="50" cy="50" r="8" fill="white"/></svg>`,
  
  // C6 Bank - Preto/Cinza
  c6: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#1a1a1a"/><text x="50" y="62" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="32">C6</text></svg>`,
  
  // Itaú - Laranja/Azul #003399 e #FF6600
  itau: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#003399"/><rect x="20" y="30" width="60" height="40" rx="8" fill="#FF6600"/><text x="50" y="58" text-anchor="middle" fill="#003399" font-family="Arial" font-weight="bold" font-size="20">itaú</text></svg>`,
  
  // Bradesco - Vermelho #CC092F
  bradesco: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#CC092F"/><path d="M25 50 L50 30 L75 50 L50 70 Z" fill="white"/></svg>`,
  
  // Santander - Vermelho #EC0000
  santander: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#EC0000"/><path d="M50 25 L65 50 L50 75 L35 50 Z" fill="white"/><circle cx="50" cy="50" r="8" fill="#EC0000"/></svg>`,
  
  // Caixa - Azul #005CA9
  caixa: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#005CA9"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="16">CAIXA</text></svg>`,
  
  // Banco do Brasil - Amarelo #FFCC00
  bb: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#FFCC00"/><text x="50" y="62" text-anchor="middle" fill="#003366" font-family="Arial" font-weight="bold" font-size="36">BB</text></svg>`,
  
  // Neon - Verde #00E88F
  neon: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#00E88F"/><text x="50" y="60" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="22">neon</text></svg>`,
  
  // PicPay - Verde #21C25E
  picpay: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#21C25E"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="16">PicPay</text></svg>`,
  
  // Mercado Pago - Azul claro #00B1EA
  mercadopago: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#00B1EA"/><text x="50" y="55" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="14">Mercado</text><text x="50" y="72" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="14">Pago</text></svg>`,
  
  // PagBank/PagSeguro - Verde #00A94F
  pagbank: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#00A94F"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="16">PagBank</text></svg>`,
  
  // Stone - Verde #00A868
  stone: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#00A868"/><rect x="30" y="35" width="40" height="30" rx="4" fill="white"/></svg>`,
  
  // BTG Pactual - Azul escuro #00263A
  btg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#00263A"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="18">BTG</text></svg>`,
  
  // XP Investimentos - Preto/Amarelo
  xp: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#1a1a1a"/><text x="50" y="62" text-anchor="middle" fill="#FFD100" font-family="Arial" font-weight="bold" font-size="32">XP</text></svg>`,
  
  // Safra - Verde escuro #006341
  safra: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#006341"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="18">SAFRA</text></svg>`,
  
  // Original - Verde #00A651
  original: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#00A651"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="14">Original</text></svg>`,
  
  // Sicoob - Verde #003641
  sicoob: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#003641"/><text x="50" y="58" text-anchor="middle" fill="#00A651" font-family="Arial" font-weight="bold" font-size="16">Sicoob</text></svg>`,
  
  // Sicredi - Verde #00543E
  sicredi: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#00543E"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="16">Sicredi</text></svg>`,
  
  // Banrisul - Azul #003366
  banrisul: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#003366"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="14">Banrisul</text></svg>`,
  
  // BMG - Laranja #F37021
  bmg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#F37021"/><text x="50" y="62" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="28">BMG</text></svg>`,
  
  // Daycoval - Azul #003B71
  daycoval: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#003B71"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="12">Daycoval</text></svg>`,
  
  // Sofisa - Azul #0033A0
  sofisa: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#0033A0"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="16">Sofisa</text></svg>`,
  
  // Unicred - Azul #003087
  unicred: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#003087"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="14">Unicred</text></svg>`,
  
  // Will Bank - Rosa #FF0066
  will: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#FF0066"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="18">Will</text></svg>`,
  
  // Cora - Rosa #FF3366
  cora: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#FF3366"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="20">Cora</text></svg>`,
  
  // iFood - Vermelho #EA1D2C
  ifood: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#EA1D2C"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="18">iFood</text></svg>`,
  
  // Ame Digital - Magenta #E6007E
  ame: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#E6007E"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="20">Ame</text></svg>`,
  
  // RecargaPay - Azul #0066FF
  recargapay: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#0066FF"/><text x="50" y="55" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="12">Recarga</text><text x="50" y="70" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="12">Pay</text></svg>`,
  
  // 99Pay - Amarelo #FFCB05
  '99pay': `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#FFCB05"/><text x="50" y="62" text-anchor="middle" fill="#1a1a1a" font-family="Arial" font-weight="bold" font-size="24">99</text></svg>`,
  
  // ========== BANDEIRAS DE CARTÃO ==========
  
  // Visa - Azul #1A1F71
  visa: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#1A1F71"/><text x="50" y="62" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="28" font-style="italic">VISA</text></svg>`,
  
  // Mastercard - Vermelho/Laranja
  mastercard: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#1a1a1a"/><circle cx="38" cy="50" r="22" fill="#EB001B"/><circle cx="62" cy="50" r="22" fill="#F79E1B"/><path d="M50 32c5.5 4.5 9 11.2 9 18s-3.5 13.5-9 18c-5.5-4.5-9-11.2-9-18s3.5-13.5 9-18z" fill="#FF5F00"/></svg>`,
  
  // Elo - Amarelo/Preto
  elo: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#1a1a1a"/><circle cx="35" cy="50" r="15" fill="#FFCB05"/><circle cx="55" cy="50" r="15" fill="#00A4E0"/><circle cx="75" cy="50" r="15" fill="#EF4123"/><text x="50" y="85" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="16">elo</text></svg>`,
  
  // American Express - Azul
  amex: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#006FCF"/><text x="50" y="55" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="14">AMERICAN</text><text x="50" y="72" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="14">EXPRESS</text></svg>`,
  
  // Hipercard - Vermelho
  hipercard: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#B3131B"/><text x="50" y="55" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="12">HIPER</text><text x="50" y="70" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="12">CARD</text></svg>`,
  
  // Diners Club - Azul
  diners: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#0079BE"/><circle cx="50" cy="50" r="25" fill="white"/><rect x="35" y="40" width="5" height="20" fill="#0079BE"/><rect x="60" y="40" width="5" height="20" fill="#0079BE"/></svg>`,
  
  // Alelo - Verde
  alelo: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#00A651"/><text x="50" y="60" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="22">alelo</text></svg>`,
  
  // Sodexo - Vermelho
  sodexo: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#ED1C24"/><text x="50" y="60" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="18">Sodexo</text></svg>`,
  
  // VR - Azul
  vr: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#003399"/><text x="50" y="65" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="36">VR</text></svg>`,
  
  // Ticket - Vermelho
  ticket: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#E30613"/><text x="50" y="60" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="18">Ticket</text></svg>`,
  
  // Flash - Laranja
  flash: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#FF6B00"/><text x="50" y="60" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="20">Flash</text></svg>`,
  
  // Caju - Verde
  caju: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#00C896"/><text x="50" y="60" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="22">Caju</text></svg>`,
  
  // iFood Benefícios - Vermelho
  ifoodbeneficios: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#EA1D2C"/><text x="50" y="50" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="16">iFood</text><text x="50" y="68" text-anchor="middle" fill="white" font-family="Arial" font-size="12">Benefícios</text></svg>`,
  
  // Swile - Roxo
  swile: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#6B4EFF"/><text x="50" y="60" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="20">Swile</text></svg>`,
  
  // ========== BANCOS INTERNACIONAIS ==========
  
  // Wise - Verde
  wise: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#9FE870"/><text x="50" y="60" text-anchor="middle" fill="#163300" font-family="Arial" font-weight="bold" font-size="20">Wise</text></svg>`,
  
  // Nomad - Azul
  nomad: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#0066FF"/><text x="50" y="60" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="18">Nomad</text></svg>`,
  
  // PayPal - Azul
  paypal: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#003087"/><text x="50" y="60" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="18">PayPal</text></svg>`,
  
  // Revolut - Preto
  revolut: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#191C1F"/><text x="50" y="60" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="16">Revolut</text></svg>`,
  
  // N26 - Verde água
  n26: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#36A18B"/><text x="50" y="62" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="28">N26</text></svg>`,
  
  // Avenue - Roxo
  avenue: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#6B21A8"/><text x="50" y="60" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="16">Avenue</text></svg>`,
  
  // Passfolio - Azul
  passfolio: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#1E40AF"/><text x="50" y="55" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="12">Pass</text><text x="50" y="70" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="12">folio</text></svg>`,
  
  // Remessa Online - Verde
  remessa: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#00A651"/><text x="50" y="55" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="12">Remessa</text><text x="50" y="70" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="12">Online</text></svg>`,
  
  // Husky - Azul
  husky: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#2563EB"/><text x="50" y="60" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="18">Husky</text></svg>`,
  
  // BS2 - Azul escuro
  bs2: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#1E3A5F"/><text x="50" y="62" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="28">BS2</text></svg>`,
  
  // C6 Global - Preto com detalhe azul
  c6global: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#1a1a1a"/><text x="50" y="55" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="24">C6</text><text x="50" y="72" text-anchor="middle" fill="#00B1EA" font-family="Arial" font-weight="bold" font-size="14">Global</text></svg>`,
};

// Mapeamento de palavras-chave para identificar o banco
const BANK_KEYWORDS: Record<string, string[]> = {
  nubank: ['nubank', 'nu ', 'roxinho'],
  inter: ['inter', 'banco inter'],
  c6: ['c6', 'c6 bank'],
  itau: ['itau', 'itaú', 'iti'],
  bradesco: ['bradesco', 'next'],
  santander: ['santander'],
  caixa: ['caixa', 'cef', 'caixa economica'],
  bb: ['banco do brasil', 'bb ', ' bb'],
  neon: ['neon'],
  picpay: ['picpay', 'pic pay'],
  mercadopago: ['mercado pago', 'mercadopago', 'mp '],
  pagbank: ['pagbank', 'pagseguro', 'pag bank'],
  stone: ['stone', 'ton '],
  btg: ['btg', 'btg pactual'],
  xp: ['xp ', ' xp', 'xp investimentos'],
  safra: ['safra'],
  original: ['original', 'banco original'],
  sicoob: ['sicoob'],
  sicredi: ['sicredi'],
  banrisul: ['banrisul'],
  bmg: ['bmg'],
  daycoval: ['daycoval'],
  sofisa: ['sofisa'],
  unicred: ['unicred'],
  will: ['will bank', 'will '],
  cora: ['cora'],
  ifood: ['ifood', 'i food'],
  ame: ['ame digital', 'ame '],
  recargapay: ['recargapay', 'recarga pay'],
  '99pay': ['99pay', '99 pay', '99'],
  
  // Bandeiras de cartão
  visa: ['visa'],
  mastercard: ['mastercard', 'master card', 'master'],
  elo: ['elo '],
  amex: ['amex', 'american express', 'americanexpress'],
  hipercard: ['hipercard', 'hiper card', 'hiper'],
  diners: ['diners', 'diners club'],
  alelo: ['alelo'],
  sodexo: ['sodexo'],
  vr: ['vr ', ' vr'],
  ticket: ['ticket'],
  flash: ['flash'],
  caju: ['caju'],
  ifoodbeneficios: ['ifood beneficio', 'ifood benefícios'],
  swile: ['swile'],
};

/**
 * Busca o SVG do banco baseado no nome da conta
 * @param accountName Nome da conta
 * @returns SVG string ou null
 */
export const getBankSvg = (accountName: string): string | null => {
  if (!accountName) return null;
  
  const normalizedName = accountName.toLowerCase().trim();
  
  // Busca por palavra-chave
  for (const [bankKey, keywords] of Object.entries(BANK_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedName.includes(keyword) || normalizedName === keyword.trim()) {
        return BANK_SVGS[bankKey] || null;
      }
    }
  }
  
  return null;
};

/**
 * Lista de bancos disponíveis para sugestão
 */
export const AVAILABLE_BANKS = [
  'Nubank',
  'Banco Inter',
  'C6 Bank',
  'Itaú',
  'Bradesco',
  'Santander',
  'Caixa',
  'Banco do Brasil',
  'Neon',
  'PicPay',
  'Mercado Pago',
  'PagBank',
  'Stone',
  'BTG Pactual',
  'XP Investimentos',
  'Safra',
  'Original',
  'Sicoob',
  'Sicredi',
  'Banrisul',
  'BMG',
  'Daycoval',
  'Sofisa',
  'Unicred',
  'Will Bank',
  'Cora',
  'iFood',
  'Ame Digital',
  'RecargaPay',
  '99Pay',
];
