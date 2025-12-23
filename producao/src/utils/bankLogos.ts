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
  { code: 'interglobal', name: 'Inter Global' },
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
  
  // Wise - Verde Bright #9FE870 e Forest #163300
  wise: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#9FE870"/><path d="M25 55 L35 35 L50 55 L65 35 L75 55" stroke="#163300" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><text x="50" y="78" text-anchor="middle" fill="#163300" font-family="Arial" font-weight="bold" font-size="14">wise</text></svg>`,
  
  // Nomad - Azul #0066FF com ícone de globo
  nomad: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#0066FF"/><circle cx="50" cy="42" r="18" stroke="white" stroke-width="3" fill="none"/><ellipse cx="50" cy="42" rx="8" ry="18" stroke="white" stroke-width="2" fill="none"/><line x1="32" y1="42" x2="68" y2="42" stroke="white" stroke-width="2"/><text x="50" y="78" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="14">Nomad</text></svg>`,
  
  // PayPal - Azul #003087 e #009CDE com PP estilizado
  paypal: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#003087"/><text x="35" y="58" fill="#009CDE" font-family="Arial" font-weight="bold" font-size="36">P</text><text x="50" y="58" fill="white" font-family="Arial" font-weight="bold" font-size="36">P</text><text x="50" y="80" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="12">PayPal</text></svg>`,
  
  // Revolut - Preto #191C1F com R estilizado
  revolut: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#191C1F"/><circle cx="50" cy="50" r="25" stroke="url(#revGrad)" stroke-width="4" fill="none"/><defs><linearGradient id="revGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#00D4FF"/><stop offset="100%" style="stop-color:#0075FF"/></linearGradient></defs><text x="50" y="56" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="20">R</text></svg>`,
  
  // N26 - Teal #2B697A (Paradiso)
  n26: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#2B697A"/><text x="50" y="62" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="32">N26</text></svg>`,
  
  // Avenue - Roxo/Violeta com A estilizado
  avenue: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#6B21A8"/><path d="M35 70 L50 30 L65 70 M40 55 L60 55" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><text x="50" y="88" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="11">Avenue</text></svg>`,
  
  // Passfolio - Azul com ícone de gráfico
  passfolio: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#1E40AF"/><path d="M30 65 L45 50 L55 58 L70 35" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="70" cy="35" r="5" fill="#10B981"/><text x="50" y="85" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="11">Passfolio</text></svg>`,
  
  // Remessa Online - Verde com setas
  remessa: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#00A651"/><path d="M30 50 L50 35 L50 45 L70 45 L70 55 L50 55 L50 65 Z" fill="white"/><text x="50" y="85" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="10">Remessa</text></svg>`,
  
  // Husky - Azul com ícone de cachorro estilizado
  husky: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#2563EB"/><ellipse cx="50" cy="42" rx="20" ry="18" fill="white"/><circle cx="42" cy="38" r="4" fill="#2563EB"/><circle cx="58" cy="38" r="4" fill="#2563EB"/><ellipse cx="50" cy="48" rx="6" ry="4" fill="#2563EB"/><path d="M30 30 L38 42 M70 30 L62 42" stroke="white" stroke-width="4" stroke-linecap="round"/><text x="50" y="80" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="14">Husky</text></svg>`,
  
  // BS2 - Azul escuro
  bs2: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#1E3A5F"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="28">BS2</text><rect x="25" y="65" width="50" height="4" rx="2" fill="#00A3E0"/></svg>`,
  
  // C6 Global - Preto com detalhe azul
  c6global: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#1a1a1a"/><text x="50" y="50" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="28">C6</text><circle cx="50" cy="68" r="8" stroke="#00B1EA" stroke-width="2" fill="none"/><line x1="42" y1="68" x2="58" y2="68" stroke="#00B1EA" stroke-width="2"/></svg>`,
  
  // Inter Global - Laranja com globo
  interglobal: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="20" fill="#FF7A00"/><circle cx="50" cy="45" r="20" stroke="white" stroke-width="3" fill="none"/><ellipse cx="50" cy="45" rx="10" ry="20" stroke="white" stroke-width="2" fill="none"/><line x1="30" y1="45" x2="70" y2="45" stroke="white" stroke-width="2"/><text x="50" y="82" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="11">Inter Global</text></svg>`,
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
