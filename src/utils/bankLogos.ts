/**
 * Mapeamento de logos de bancos brasileiros
 * Fonte: https://github.com/Tgentil/Bancos-em-SVG
 */

const BASE_URL = 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main/Bancos/';

// Mapeamento de palavras-chave para arquivos de logo
const BANK_LOGOS: Record<string, string> = {
  // Bancos Digitais
  'nubank': 'Nu%20Pagamentos%20S.A%20(Nubank).svg',
  'nu': 'Nu%20Pagamentos%20S.A%20(Nubank).svg',
  'inter': 'Banco%20Inter%20S.A.svg',
  'c6': 'Banco%20C6%20S.A.svg',
  'c6 bank': 'Banco%20C6%20S.A.svg',
  'neon': 'Neon.svg',
  'original': 'Banco%20Original%20S.A.svg',
  'next': 'Bradesco%20S.A.svg', // Next é do Bradesco
  'picpay': 'PicPay.svg',
  'mercado pago': 'Mercado%20Pago.svg',
  'mercadopago': 'Mercado%20Pago.svg',
  'pagseguro': 'PagSeguro%20Internet%20S.A.svg',
  'pagbank': 'PagSeguro%20Internet%20S.A.svg',
  'stone': 'Stone%20Pagamentos%20S.A.svg',
  'will': 'Will%20Bank.svg',
  'will bank': 'Will%20Bank.svg',
  'iti': 'Itaú%20Unibanco%20S.A.svg', // iti é do Itaú
  'cora': 'Cora%20Sociedade%20Crédito%20Direto%20S.A.svg',
  'recargapay': 'RecargaPay.svg',
  'infinitepay': 'InfinitePay.svg',
  'ifood': 'Ifood%20Pago.svg',
  
  // Bancos Tradicionais
  'itau': 'Itaú%20Unibanco%20S.A.svg',
  'itaú': 'Itaú%20Unibanco%20S.A.svg',
  'bradesco': 'Bradesco%20S.A.svg',
  'santander': 'Banco%20Santander%20Brasil%20S.A.svg',
  'caixa': 'Caixa%20Econômica%20Federal.svg',
  'cef': 'Caixa%20Econômica%20Federal.svg',
  'bb': 'Banco%20do%20Brasil%20S.A.svg',
  'banco do brasil': 'Banco%20do%20Brasil%20S.A.svg',
  'safra': 'Banco%20Safra%20S.A.svg',
  'btg': 'Banco%20BTG%20Pactual.svg',
  'btg pactual': 'Banco%20BTG%20Pactual.svg',
  'xp': 'XP%20Investimentos.svg',
  'xp investimentos': 'XP%20Investimentos.svg',
  'banrisul': 'Banrisul.svg',
  'brb': 'BRB%20-%20Banco%20de%20Brasília.svg',
  'daycoval': 'Banco%20Daycoval.svg',
  'votorantim': 'Banco%20Votorantim.svg',
  'bmg': 'BMG.svg',
  'sofisa': 'Banco%20Sofisa.svg',
  'bs2': 'Banco%20BS2%20S.A.svg',
  'pine': 'Banco%20Pine.svg',
  'abc': 'ABC%20Brasil.svg',
  'abc brasil': 'ABC%20Brasil.svg',
  'rendimento': 'Banco%20Rendimento.svg',
  'mercantil': 'Banco%20Mercantil%20do%20Brasil.svg',
  'nordeste': 'Banco%20do%20Nordeste%20do%20Brasil%20S.A.svg',
  'bnb': 'Banco%20do%20Nordeste%20do%20Brasil%20S.A.svg',
  'amazonia': 'Banco%20da%20Amazônia%20S.A.svg',
  'basa': 'Banco%20da%20Amazônia%20S.A.svg',
  'banestes': 'Banco%20do%20Estado%20do%20Espírito%20Santo.svg',
  'banpara': 'Banco%20do%20Estado%20do%20Pará.svg',
  'banese': 'Banco%20do%20Estado%20do%20Sergipe.svg',
  
  // Cooperativas
  'sicoob': 'Sicoob.svg',
  'sicredi': 'Sicredi.svg',
  'unicred': 'Unicred.svg',
  'cresol': 'Cresol.svg',
  'ailos': 'Ailos.svg',
  'uniprime': 'Uniprime.svg',
  'credisis': 'Credisis.svg',
  
  // Fintechs e Outros
  'asaas': 'Asaas%20IP%20S.A.svg',
  'efi': 'Efí%20-%20Gerencianet.svg',
  'gerencianet': 'Efí%20-%20Gerencianet.svg',
  'iugu': 'Iugu%20IP%20S.A.svg',
  'omie': 'Omie.cash.svg',
  'conta simples': 'Conta%20Simples%20Soluções%20em%20Pagamentos.svg',
  'magalu': 'MagaluPay.svg',
  'magalupay': 'MagaluPay.svg',
  'bnp': 'BNP%20Paribas.svg',
  'bnp paribas': 'BNP%20Paribas.svg',
  
  // Cartões
  'elo': 'Elo.svg',
  'visa': 'Visa.svg',
  'mastercard': 'Mastercard.svg',
  'amex': 'American%20Express.svg',
  'american express': 'American%20Express.svg',
  'hipercard': 'Hipercard.svg',
};

/**
 * Busca o logo do banco baseado no nome da conta
 * @param accountName Nome da conta (ex: "Nubank", "Conta Itaú", "Cartão Bradesco")
 * @returns URL do logo ou null se não encontrado
 */
export const getBankLogoUrl = (accountName: string): string | null => {
  if (!accountName) return null;
  
  const normalizedName = accountName.toLowerCase().trim();
  
  // Busca direta
  if (BANK_LOGOS[normalizedName]) {
    return BASE_URL + BANK_LOGOS[normalizedName];
  }
  
  // Busca por palavra-chave contida no nome
  for (const [keyword, logoFile] of Object.entries(BANK_LOGOS)) {
    if (normalizedName.includes(keyword)) {
      return BASE_URL + logoFile;
    }
  }
  
  return null;
};

/**
 * Lista de bancos disponíveis para autocomplete/sugestão
 */
export const AVAILABLE_BANKS = [
  'Nubank',
  'Banco Inter',
  'C6 Bank',
  'Neon',
  'PicPay',
  'Mercado Pago',
  'PagBank',
  'Stone',
  'Itaú',
  'Bradesco',
  'Santander',
  'Caixa',
  'Banco do Brasil',
  'Safra',
  'BTG Pactual',
  'XP Investimentos',
  'Banrisul',
  'Sicoob',
  'Sicredi',
  'Unicred',
  'Original',
  'BMG',
  'Sofisa',
  'Daycoval',
];
