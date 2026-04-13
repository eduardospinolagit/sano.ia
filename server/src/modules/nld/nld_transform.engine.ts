/**
 * nld_transform.engine.ts
 *
 * Transforma o texto original do LLM para parecer mais humano:
 *  - contrações coloquiais (você → vc, estou → tô)
 *  - remoção de conectores formais
 *  - redução de pontuação perfeita
 *  - capitalização natural (não necessariamente correta)
 *  - imperfeições leves e probabilísticas
 *
 * NUNCA altera o sentido do texto. NUNCA adiciona conteúdo.
 */

import type { NLDStyleProfile, CapitalizationStyle, PunctuationStyle, PolishLevel } from './nld_style.engine'

// ─── Contrações coloquiais por nível ──────────────────────────

const CONTRACTIONS_LOW: [RegExp, string][] = [
  [/\bvocê\b/gi,   'vc'],
  [/\bvocês\b/gi,  'vcs'],
  [/\bestou\b/gi,  'tô'],
  [/\bpara\b/gi,   'pra'],
  [/\bpara o\b/gi, 'pro'],
  [/\bpara a\b/gi, 'pra'],
  [/\bestava\b/gi, 'tava'],
  [/\bestavam\b/gi,'tavam'],
  [/\bestamos\b/gi,'tamo'],
  [/\bmuito\b/gi,  'mt'],
  [/\btambém\b/gi, 'tb'],
  [/\bporque\b/gi, 'pq'],
  [/\bpor que\b/gi,'pq'],
]

const CONTRACTIONS_MEDIUM: [RegExp, string][] = [
  [/\bvocê\b/gi,  'vc'],
  [/\bvocês\b/gi, 'vcs'],
  [/\bpara\b/gi,  'pra'],
  [/\bmuito\b/gi, 'mt'],
]

// ─── Conectores formais para remover ─────────────────────────

const FORMAL_CONNECTORS: [RegExp, string][] = [
  [/\bAdemais[,\s]+/gi,          ''],
  [/\bPortanto[,\s]+/gi,         ''],
  [/\bContudo[,\s]+/gi,          'mas '],
  [/\bEntretanto[,\s]+/gi,       'mas '],
  [/\bNo entanto[,\s]+/gi,       'mas '],
  [/\bPorém[,\s]+/gi,            'mas '],
  [/\bAssim sendo[,\s]+/gi,      ''],
  [/\bDessa forma[,\s]+/gi,      ''],
  [/\bNesse sentido[,\s]+/gi,    ''],
  [/\bEm primeiro lugar[,\s]+/gi,''],
  [/\bAlém disso[,\s]+/gi,       ''],
  [/\bDe fato[,\s]+/gi,          ''],
]

// ─── Aplicação de contrações ──────────────────────────────────

function applyContractions(text: string, level: PolishLevel): string {
  if (level === 'high') return text

  const list = level === 'low' ? CONTRACTIONS_LOW : CONTRACTIONS_MEDIUM
  let result = text
  for (const [pattern, replacement] of list) {
    result = result.replace(pattern, replacement)
  }
  return result
}

// ─── Remoção de conectores formais ────────────────────────────

function applyPolishReduction(text: string, level: PolishLevel): string {
  if (level === 'high') return text

  let result = text
  for (const [pattern, replacement] of FORMAL_CONNECTORS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

// ─── Pontuação ────────────────────────────────────────────────

function applyPunctuation(text: string, style: PunctuationStyle): string {
  if (style === 'normal') return text

  let result = text

  // Remove ponto final no fim (não fica natural em mensagem curta)
  result = result.replace(/\.\s*$/, '')

  if (style === 'light') {
    // Remove vírgulas antes de conjunções simples
    result = result.replace(/,\s*(e|ou|que)\s/gi, ' $1 ')
    // Remove vírgula + espaço redundante antes de mas (já é natural sem)
    result = result.replace(/,\s*(mas)\s/gi, ' $1 ')
  }

  if (style === 'minimal') {
    // Converte pontos intermediários em espaço (frases viram sequência contínua)
    result = result.replace(/\.\s+/g, ' ')
    // Remove vírgulas exceto antes de "mas" e "porém"
    result = result.replace(/,\s*(?!(mas|porém|então)\b)/gi, ' ')
    // Normaliza
    result = result.replace(/\s+/g, ' ').trim()
  }

  return result
}

// ─── Capitalização ────────────────────────────────────────────

function applyCapitalization(text: string, style: CapitalizationStyle): string {
  if (style === 'normal') return text

  if (style === 'fully_lowercase') {
    return text.toLowerCase()
  }

  // mostly_lowercase: lowercase início + sentence starts com variação
  let result = text

  // Lowercase a primeira letra
  result = result.charAt(0).toLowerCase() + result.slice(1)

  // Após pontuação final: lowercase com 70% de prob (30% mantém capital p/ variar)
  result = result.replace(
    /([.!?…]\s+)([A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ])/g,
    (match, sep, letter) => {
      if (Math.random() < 0.30) return match   // mantém maiúscula ocasionalmente
      return sep + letter.toLowerCase()
    }
  )

  return result
}

// ─── Imperfeições leves ───────────────────────────────────────

function applyImperfections(text: string, style: NLDStyleProfile): string {
  if (style.spontaneity === 'low') return text

  let result = text.trim()

  // Alta espontaneidade: 12% de chance de adicionar reticências no final
  if (style.spontaneity === 'high' && Math.random() < 0.12) {
    // Só se não termina com pontuação forte
    if (!/[?!…]$/.test(result)) {
      result = result + '…'
    }
  }

  return result
}

// ─── Entry point ─────────────────────────────────────────────

export function transformText(text: string, style: NLDStyleProfile): string {
  let result = text.trim()
  if (!result) return result

  // Textos muito curtos: só capitalização (sem mexer na estrutura)
  if (result.length < 18) {
    return applyCapitalization(result, style.capitalization_style)
  }

  // 1. Remove conectores formais
  result = applyPolishReduction(result, style.polish_level)

  // 2. Contrações
  result = applyContractions(result, style.polish_level)

  // 3. Pontuação
  result = applyPunctuation(result, style.punctuation_style)

  // 4. Capitalização
  result = applyCapitalization(result, style.capitalization_style)

  // 5. Imperfeições probabilísticas
  result = applyImperfections(result, style)

  // Normaliza espaços duplos
  result = result.replace(/\s+/g, ' ').trim()

  return result
}
