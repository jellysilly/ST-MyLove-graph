/**
 * MyLove Graph - reading the mood of a scene.
 *
 * The chronicle needs to know *what kind* of bond a scene is building, and it
 * has to do it inside SillyTavern, on a phone, without calling a model. So this
 * is a small word-stem scorer: every entry is matched as a prefix of a token,
 * which is what lets one entry cover a whole Russian paradigm ("обним" catches
 * обнимает / обнял / обнимая) and English inflections alike.
 *
 * It is deliberately blunt. A single word never decides a relationship - the
 * chronicle collects votes across dozens of messages before a bond takes shape,
 * so a stray "kill" in a joke cannot turn friends into enemies.
 */

/** Tokenises text into lowercase words, Unicode-aware. */
export function tokenize(text) {
    if (!text) return [];
    const cleaned = String(text)
        // Strip markdown emphasis and quotes so *hugs* scores like hugs.
        .replace(/[*_~`"“”«»]/g, ' ')
        .toLowerCase();
    return cleaned.match(/[\p{L}\p{N}]+/gu) || [];
}

const STEMS = {
    love: [
        'love', 'lover', 'kiss', 'adore', 'beloved', 'darling', 'sweetheart', 'romanc',
        'blush', 'flirt', 'desire', 'yearn', 'longing', 'marry', 'wedding', 'lust',
        'heartbeat', 'cuddl', 'caress', 'passion', 'tender',
        'люб', 'влюб', 'целу', 'поцелу', 'обожа', 'милы', 'мила', 'родна', 'ласка',
        'ласков', 'нежн', 'страст', 'желан', 'сердц', 'краснe', 'краснея', 'румян',
        'свидан', 'замуж', 'женит', 'возлюбл', 'дорога',
    ],
    close: [
        'trust', 'promis', 'protect', 'family', 'brother', 'sister', 'father', 'mother',
        'daughter', 'son', 'bond', 'loyal', 'always', 'safe', 'comfort', 'forgive',
        'confid', 'secret', 'rely', 'shelter', 'heal',
        'довер', 'обеща', 'защит', 'семь', 'брат', 'сестр', 'отец', 'мать', 'дочь',
        'сын', 'вернос', 'предан', 'рядом', 'берег', 'утеша', 'прост', 'забот',
        'спаса', 'тайн', 'опор',
    ],
    friendly: [
        'friend', 'smile', 'laugh', 'joke', 'thank', 'hello', 'greet', 'welcome',
        'help', 'together', 'nod', 'chat', 'share', 'agree', 'kind', 'cheer',
        'друж', 'друг', 'улыб', 'смеё', 'смея', 'шут', 'спасиб', 'привет', 'здравств',
        'помог', 'помощ', 'вместе', 'кивн', 'болта', 'согла', 'добр', 'рад',
    ],
    tense: [
        'hate', 'angr', 'rage', 'fight', 'betray', 'enem', 'kill', 'scream', 'shout',
        'blood', 'threat', 'curse', 'despis', 'jealous', 'blame', 'snarl', 'glare',
        'slap', 'punch', 'cold', 'liar', 'lie',
        'ненави', 'злит', 'злой', 'зла', 'ярост', 'гнев', 'дра', 'бьёт', 'удар',
        'предат', 'враг', 'убь', 'уби', 'крич', 'оруж', 'угроз', 'прокл', 'презир',
        'ревну', 'ревнос', 'винит', 'лже', 'лгун', 'холодн', 'спор', 'ссор',
    ],
};

/** Longest stems first, so "любов" is not shadowed by a shorter neighbour. */
const ORDERED = Object.entries(STEMS).map(([type, stems]) => [
    type,
    stems.slice().sort((a, b) => b.length - a.length),
]);

const MAX_PER_TYPE = 3;

/**
 * Scores a message into relationship votes.
 * @param {string} text
 * @returns {{love:number, close:number, friendly:number, tense:number}}
 */
export function scoreText(text) {
    const votes = { love: 0, close: 0, friendly: 0, tense: 0 };
    const tokens = tokenize(text);
    if (!tokens.length) return votes;

    for (const token of tokens) {
        if (token.length < 3) continue;
        for (const [type, stems] of ORDERED) {
            if (votes[type] >= MAX_PER_TYPE) continue;
            for (const stem of stems) {
                if (token.startsWith(stem)) {
                    votes[type]++;
                    break;
                }
            }
        }
    }
    return votes;
}

/** True when the message carries no emotional signal at all. */
export function isNeutral(votes) {
    return !votes.love && !votes.close && !votes.friendly && !votes.tense;
}
