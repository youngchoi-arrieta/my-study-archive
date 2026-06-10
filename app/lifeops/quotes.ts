// Daily rotating quotes. EN/ES bilingual.
// Author short tag shown beneath.

export interface Quote {
  en: string
  es: string
  who: string
}

export const QUOTES: Quote[] = [
  // ── Marcus Aurelius / Meditations ──
  { who: 'Marcus Aurelius',
    en: 'You have power over your mind — not outside events. Realize this, and you will find strength.',
    es: 'Tienes poder sobre tu mente, no sobre los eventos externos. Date cuenta de esto y hallarás fuerza.' },
  { who: 'Marcus Aurelius',
    en: 'The happiness of your life depends upon the quality of your thoughts.',
    es: 'La felicidad de tu vida depende de la calidad de tus pensamientos.' },
  { who: 'Marcus Aurelius',
    en: 'Waste no more time arguing about what a good person should be. Be one.',
    es: 'No pierdas más tiempo discutiendo cómo debe ser una buena persona. Sé una.' },
  { who: 'Marcus Aurelius',
    en: 'The impediment to action advances action. What stands in the way becomes the way.',
    es: 'El impedimento a la acción impulsa la acción. Lo que se interpone se convierte en el camino.' },
  { who: 'Marcus Aurelius',
    en: 'Confine yourself to the present.',
    es: 'Limítate al presente.' },
  { who: 'Marcus Aurelius',
    en: 'If you are distressed by anything external, the pain is not due to the thing itself, but to your estimate of it.',
    es: 'Si algo externo te angustia, el dolor no se debe a la cosa, sino a tu juicio sobre ella.' },

  // ── Zhuangzi / 莊子 ──
  { who: 'Zhuangzi 莊子',
    en: 'Flow with whatever may happen, and let your mind be free. Stay centered by accepting whatever you are doing.',
    es: 'Fluye con lo que suceda y deja libre tu mente. Permanece centrado aceptando lo que haces.' },
  { who: 'Zhuangzi 莊子',
    en: 'The wise man looks into space and does not regard the small as too little, nor the great as too much.',
    es: 'El sabio mira el espacio y no ve lo pequeño como poco ni lo grande como demasiado.' },
  { who: 'Zhuangzi 莊子',
    en: 'Happiness is the absence of striving for happiness.',
    es: 'La felicidad es la ausencia de esfuerzo por la felicidad.' },
  { who: 'Zhuangzi 莊子',
    en: 'The fish trap exists because of the fish; once you have the fish, you can forget the trap.',
    es: 'La trampa para peces existe por el pez; una vez tienes el pez, puedes olvidar la trampa.' },
  { who: 'Zhuangzi 莊子',
    en: 'When the shoe fits, the foot is forgotten.',
    es: 'Cuando el zapato calza, el pie se olvida.' },

  // ── Carl Jung ──
  { who: 'Carl Jung',
    en: 'Until you make the unconscious conscious, it will direct your life and you will call it fate.',
    es: 'Hasta que no hagas consciente lo inconsciente, dirigirá tu vida y lo llamarás destino.' },
  { who: 'Carl Jung',
    en: 'I am not what happened to me, I am what I choose to become.',
    es: 'No soy lo que me pasó, soy lo que elijo ser.' },
  { who: 'Carl Jung',
    en: 'The privilege of a lifetime is to become who you truly are.',
    es: 'El privilegio de una vida es llegar a ser quien realmente eres.' },
  { who: 'Carl Jung',
    en: 'Who looks outside, dreams; who looks inside, awakes.',
    es: 'Quien mira afuera, sueña; quien mira adentro, despierta.' },
  { who: 'Carl Jung',
    en: 'There is no coming to consciousness without pain.',
    es: 'No hay llegada a la consciencia sin dolor.' },

  // ── Jacques Lacan ──
  { who: 'Jacques Lacan',
    en: 'The unconscious is structured like a language.',
    es: 'El inconsciente está estructurado como un lenguaje.' },
  { who: 'Jacques Lacan',
    en: 'Desire is the desire of the Other.',
    es: 'El deseo es el deseo del Otro.' },
  { who: 'Jacques Lacan',
    en: 'What is realized in my history is not the past definite of what was, but the future anterior of what I will have been.',
    es: 'Lo que se realiza en mi historia no es el pretérito de lo que fue, sino el futuro anterior de lo que habré sido.' },
  { who: 'Jacques Lacan',
    en: 'Love is giving something you do not have to someone who does not want it.',
    es: 'El amor es dar algo que no se tiene a alguien que no lo quiere.' },
]

// Daily reflective prompts (Meditations-style questions), rotates with the quote.
export const REFLECTION_PROMPTS: { en: string; es: string }[] = [
  { en: 'What did you do well today, and what is still in your power to improve?',
    es: '¿Qué hiciste bien hoy y qué está aún en tu poder mejorar?' },
  { en: 'What disturbed your peace today — and was it the thing itself, or your judgment of it?',
    es: '¿Qué perturbó tu paz hoy? ¿Fue la cosa misma o tu juicio sobre ella?' },
  { en: 'What are you grateful for right now, in this ordinary moment?',
    es: '¿Por qué estás agradecido ahora, en este momento ordinario?' },
  { en: 'What did you avoid today that you know matters?',
    es: '¿Qué evitaste hoy que sabes que importa?' },
  { en: 'If today were repeated for eternity, would you live it the same way?',
    es: 'Si hoy se repitiera por la eternidad, ¿lo vivirías igual?' },
  { en: 'What were you striving to prove today, and to whom?',
    es: '¿Qué intentabas demostrar hoy, y a quién?' },
  { en: 'What did your body tell you today that your mind ignored?',
    es: '¿Qué te dijo tu cuerpo hoy que tu mente ignoró?' },
]

// Deterministic pick based on date so it changes once per day and is stable within a day.
function dayIndex(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  return Math.floor(d.getTime() / 86400000)
}

export function quoteOfDay(dateStr: string): Quote {
  return QUOTES[dayIndex(dateStr) % QUOTES.length]
}

export function promptOfDay(dateStr: string): { en: string; es: string } {
  return REFLECTION_PROMPTS[dayIndex(dateStr) % REFLECTION_PROMPTS.length]
}
