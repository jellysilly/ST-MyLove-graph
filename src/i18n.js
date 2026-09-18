/**
 * MyLove Graph - localization.
 * English is the default language, Russian is optional.
 */

export const LANGUAGES = [
    { id: 'en', label: 'English', short: 'EN' },
    { id: 'ru', label: 'Русский', short: 'RU' },
];

const DICT = {
    en: {
        'fab.tooltip': 'Open MyLove Graph',
        'fab.drag': 'Hold and drag to move',

        'panel.tagline': '"Love’s a game, wanna play?"',
        'panel.kicker': 'THE',
        'panel.close': 'Close',
        'panel.edition': 'Relations Edition',

        'tb.sync': 'Sync characters',
        'tb.add': 'Add',
        'tb.addNpc': 'Add NPC',
        'tb.addGroup': 'Import group',
        'tb.link': 'New bond',
        'tb.fit': 'Fit to screen',
        'tb.relayout': 'Rebuild layout',
        'tb.filters': 'Filters',
        'tb.search': 'Search',
        'tb.data': 'Data',
        'tb.lang': 'Language',
        'tb.settings': 'Settings',
        'tb.story': 'Chronicle',

        'story.title': 'Chronicle',
        'story.mode': 'Story mode',
        'story.read': 'Read: {read} of {total} messages · chapter {chapter}',
        'story.cast': 'Only souls the story met',
        'story.mentions': 'Count names in the text',
        'story.fade': 'Let quiet bonds cool',
        'story.pace': 'Pace',
        'story.pace.gentle': 'Slow burn',
        'story.pace.normal': 'Steady',
        'story.pace.fast': 'Whirlwind',
        'story.rebuild': 'Re-read the chat',
        'story.rebuilding': 'Reading the chat…',
        'story.rebuilt': 'Re-read: {bonds} bonds, {souls} new souls',
        'story.reading': 'reading…',
        'story.forget': 'Forget the story',

        'stage.spark': 'spark',
        'stage.forming': 'forming',
        'stage.bond': 'bond',

        'search.ph': 'Find a character…',
        'search.empty': 'Nobody matches that.',

        'rel.love': 'Love / Romantic',
        'rel.close': 'Close',
        'rel.friendly': 'Friendly / Neutral',
        'rel.tense': 'Tense / Negative',
        'rel.love.short': 'Love',
        'rel.close.short': 'Close',
        'rel.friendly.short': 'Friendly',
        'rel.tense.short': 'Tense',

        'hud.basis': 'BASIS',
        'hud.affection': 'AFFECTION',
        'hud.devotion': 'DEVOTION',
        'hud.tension': 'TENSION',
        'hud.souls': 'Souls',
        'hud.bonds': 'Bonds',
        'hud.pick': 'Pick a character to read their vitals',
        'hud.chronicle': 'CHRONICLE',
        'hud.chapter': 'CH. {n}',
        'hud.sparks': '{n} forming',
        'hud.settled': '{n} settled',

        'legend.title': 'Bonds',
        'legend.hide': 'Hide legend',

        'insp.bonds': 'Bonds',
        'insp.noBonds': 'No bonds yet.',
        'insp.edit': 'Edit',
        'insp.addLink': 'Add bond',
        'insp.remove': 'Remove',
        'insp.pin': 'Pin in place',
        'insp.unpin': 'Release',
        'insp.focus': 'Center on them',
        'insp.kind.char': 'Character',
        'insp.kind.npc': 'NPC',
        'insp.kind.persona': 'You',
        'insp.missing': 'Card not found',
        'insp.close': 'Close details',
        'insp.oneWayOut': 'one-way →',
        'insp.oneWayIn': 'one-way ←',
        'insp.mutual': 'mutual',
        'insp.enteredAt': 'entered at #{n}',

        'node.title.new': 'New NPC',
        'node.title.edit': 'Edit character',
        'node.name': 'Name',
        'node.namePh': 'Who are they?',
        'node.role': 'Role',
        'node.rolePh': 'barmaid, rival, ghost…',
        'node.note': 'Notes',
        'node.notePh': 'Anything worth remembering…',
        'node.avatar': 'Avatar URL',
        'node.avatarPh': 'https://… (optional)',
        'node.color': 'Accent colour',
        'node.aliases': 'Also known as',
        'node.aliasesPh': 'Ари, the captain, Ария…',
        'node.aliasesHint': 'Comma separated. The chronicle looks for these names in the story too.',
        'node.nameRequired': 'A name is required.',
        'node.lockedHint': 'The name follows the character card.',

        'edge.title.new': 'New bond',
        'edge.title.edit': 'Edit bond',
        'edge.from': 'From',
        'edge.to': 'To',
        'edge.type': 'Type',
        'edge.strength': 'Strength',
        'edge.dir': 'Direction',
        'edge.dir.both': 'Mutual',
        'edge.dir.a2b': 'One-way →',
        'edge.dir.b2a': 'One-way ←',
        'edge.note': 'Label',
        'edge.notePh': 'unrequited, secret, sworn enemies…',
        'edge.pick': 'Choose the other side',
        'edge.exists': 'These two are already bound.',
        'edge.same': 'Pick two different characters.',
        'edge.needTwo': 'Add at least two characters first.',
        'edge.growth': 'How far it has come',
        'edge.sinceMsg': 'Woven from message #{n} · {hits} scenes together',
        'edge.fromStory': 'Written by the story itself.',
        'edge.locked': 'yours',
        'edge.unlock': 'Let the story steer it again',

        'filters.title': 'Show bonds',
        'filters.orphans': 'Lonely souls',
        'filters.labels': 'Names',
        'filters.avatars': 'Avatars',

        'data.export': 'Export JSON',
        'data.import': 'Import JSON',
        'data.clear': 'Clear graph',
        'data.imported': 'Imported: {nodes} souls, {edges} bonds',
        'data.badFile': 'That file is not a MyLove graph.',
        'data.exported': 'Graph exported.',

        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
        'common.ok': 'OK',
        'common.close': 'Close',
        'common.reset': 'Reset',
        'common.back': 'Back',

        'confirm.deleteNode': 'Remove {name} from the graph? Their bonds will be cut.',
        'confirm.deleteEdge': 'Cut this bond?',
        'confirm.clear': 'Erase the whole graph? This cannot be undone.',
        'confirm.forget': 'Forget everything the story wrote? Hand-made bonds stay.',

        'toast.synced': 'Synced: +{added} new, {total} total',
        'toast.nothingNew': 'Everyone is already on the board.',
        'toast.groupAdded': 'Added {n} from the group.',
        'toast.noGroups': 'No groups yet.',
        'toast.nodeRemoved': '{name} left the board.',

        'empty.title': 'The board is empty',
        'empty.body': 'Sync your characters or add an NPC to start weaving bonds.',
        'empty.cta': 'Sync characters',
        'empty.story.title': 'The story has not started',
        'empty.story.body': 'Story mode draws the map as you play: souls appear when they enter the scene, and bonds grow out of what happens between them.',
        'empty.story.cta': 'Read the chat',

        'group.pick': 'Pick a group',

        'set.hint': 'A living map of who loves, trusts or resents whom — across every character and NPC.',
        'set.lang': 'Language',
        'set.open': 'Open the graph',
        'set.appearance': 'Appearance',
        'set.fab': 'Floating heart button',
        'set.anim': 'Animations',
        'set.lite': 'Lite mode',
        'set.lite.auto': 'Auto',
        'set.lite.on': 'Always on',
        'set.lite.off': 'Off',
        'set.liteHint': 'Fewer effects, lighter rendering. Auto turns it on for touch devices.',
        'set.labels': 'Show names',
        'set.avatars': 'Show avatars',
        'set.curved': 'Curved bonds',
        'set.autosync': 'Auto-add new characters',
        'set.wand': 'Show in the extensions menu',
        'set.stats': '{nodes} souls · {edges} bonds',
        'set.resetPos': 'Reset heart position',
        'set.story': 'Story mode',
        'set.storyHint': 'The map writes itself as you roleplay: a soul appears when they enter the scene, and every shared scene pushes the bond between two of them a little further along.',
        'set.storyMode': 'Grow bonds from the chat',
        'set.storyCast': 'Only souls the story met',
        'set.storyMentions': 'Count names in the text',
        'set.storyFade': 'Let quiet bonds cool',
        'set.storyPace': 'Pace',
        'set.storyRebuild': 'Re-read the chat',
        'set.storyForget': 'Forget the story',
        'set.storyStats': 'Read {read} of {total} · chapter {chapter} · {sparks} forming, {settled} settled',
    },

    ru: {
        'fab.tooltip': 'Открыть MyLove Graph',
        'fab.drag': 'Зажмите и тяните, чтобы переместить',

        'panel.tagline': '«Любовь — это игра. Сыграем?»',
        'panel.kicker': 'THE',
        'panel.close': 'Закрыть',
        'panel.edition': 'Издание «Связи»',

        'tb.sync': 'Синхронизировать персонажей',
        'tb.add': 'Добавить',
        'tb.addNpc': 'Добавить NPC',
        'tb.addGroup': 'Импорт группы',
        'tb.link': 'Новая связь',
        'tb.fit': 'Вписать в экран',
        'tb.relayout': 'Перестроить схему',
        'tb.filters': 'Фильтры',
        'tb.search': 'Поиск',
        'tb.data': 'Данные',
        'tb.lang': 'Язык',
        'tb.settings': 'Настройки',
        'tb.story': 'Хроника',

        'story.title': 'Хроника',
        'story.mode': 'Режим истории',
        'story.read': 'Прочитано: {read} из {total} сообщений · глава {chapter}',
        'story.cast': 'Только те, кого встретила история',
        'story.mentions': 'Считать имена в тексте',
        'story.fade': 'Остывание забытых связей',
        'story.pace': 'Темп',
        'story.pace.gentle': 'Медленно',
        'story.pace.normal': 'Ровно',
        'story.pace.fast': 'Вихрем',
        'story.rebuild': 'Перечитать чат',
        'story.rebuilding': 'Читаю чат…',
        'story.rebuilt': 'Перечитано: связей — {bonds}, новых душ — {souls}',
        'story.reading': 'читаю…',
        'story.forget': 'Забыть историю',

        'stage.spark': 'искра',
        'stage.forming': 'крепнет',
        'stage.bond': 'связь',

        'search.ph': 'Найти персонажа…',
        'search.empty': 'Никто не найден.',

        'rel.love': 'Любовные / Романтические',
        'rel.close': 'Близкие',
        'rel.friendly': 'Дружелюбные / Нейтральные',
        'rel.tense': 'Напряжённые / Негативные',
        'rel.love.short': 'Любовь',
        'rel.close.short': 'Близкие',
        'rel.friendly.short': 'Друзья',
        'rel.tense.short': 'Напряжение',

        'hud.basis': 'ОСНОВА',
        'hud.affection': 'ПРИВЯЗАННОСТЬ',
        'hud.devotion': 'ПРЕДАННОСТЬ',
        'hud.tension': 'НАПРЯЖЕНИЕ',
        'hud.souls': 'Души',
        'hud.bonds': 'Связи',
        'hud.pick': 'Выберите персонажа, чтобы увидеть показатели',
        'hud.chronicle': 'ХРОНИКА',
        'hud.chapter': 'ГЛ. {n}',
        'hud.sparks': 'зреет — {n}',
        'hud.settled': 'сложилось — {n}',

        'legend.title': 'Связи',
        'legend.hide': 'Скрыть легенду',

        'insp.bonds': 'Связи',
        'insp.noBonds': 'Связей пока нет.',
        'insp.edit': 'Изменить',
        'insp.addLink': 'Добавить связь',
        'insp.remove': 'Убрать',
        'insp.pin': 'Закрепить',
        'insp.unpin': 'Открепить',
        'insp.focus': 'Показать в центре',
        'insp.kind.char': 'Персонаж',
        'insp.kind.npc': 'NPC',
        'insp.kind.persona': 'Вы',
        'insp.missing': 'Карточка не найдена',
        'insp.close': 'Закрыть карточку',
        'insp.oneWayOut': 'односторонняя →',
        'insp.oneWayIn': 'односторонняя ←',
        'insp.mutual': 'взаимная',
        'insp.enteredAt': 'появился(ась) на #{n}',

        'node.title.new': 'Новый NPC',
        'node.title.edit': 'Редактировать персонажа',
        'node.name': 'Имя',
        'node.namePh': 'Кто это?',
        'node.role': 'Роль',
        'node.rolePh': 'трактирщица, соперник, призрак…',
        'node.note': 'Заметки',
        'node.notePh': 'Что стоит запомнить…',
        'node.avatar': 'Ссылка на аватар',
        'node.avatarPh': 'https://… (необязательно)',
        'node.color': 'Цвет акцента',
        'node.aliases': 'Другие имена',
        'node.aliasesPh': 'Ари, капитан, Aria…',
        'node.aliasesHint': 'Через запятую. Хроника ищет в тексте и эти имена тоже.',
        'node.nameRequired': 'Имя обязательно.',
        'node.lockedHint': 'Имя берётся из карточки персонажа.',

        'edge.title.new': 'Новая связь',
        'edge.title.edit': 'Изменить связь',
        'edge.from': 'От',
        'edge.to': 'К',
        'edge.type': 'Тип',
        'edge.strength': 'Сила',
        'edge.dir': 'Направление',
        'edge.dir.both': 'Взаимная',
        'edge.dir.a2b': 'Односторонняя →',
        'edge.dir.b2a': 'Односторонняя ←',
        'edge.note': 'Подпись',
        'edge.notePh': 'безответно, тайно, заклятые враги…',
        'edge.pick': 'Выберите вторую сторону',
        'edge.exists': 'Эти двое уже связаны.',
        'edge.same': 'Выберите двух разных персонажей.',
        'edge.needTwo': 'Сначала добавьте хотя бы двух персонажей.',
        'edge.growth': 'Насколько сложилась',
        'edge.sinceMsg': 'Завязалась на сообщении #{n} · сцен вместе: {hits}',
        'edge.fromStory': 'Написана самой историей.',
        'edge.locked': 'ваша',
        'edge.unlock': 'Вернуть под управление истории',

        'filters.title': 'Показывать связи',
        'filters.orphans': 'Одиночек',
        'filters.labels': 'Имена',
        'filters.avatars': 'Аватары',

        'data.export': 'Экспорт JSON',
        'data.import': 'Импорт JSON',
        'data.clear': 'Очистить граф',
        'data.imported': 'Импортировано: душ — {nodes}, связей — {edges}',
        'data.badFile': 'Этот файл — не граф MyLove.',
        'data.exported': 'Граф выгружен.',

        'common.save': 'Сохранить',
        'common.cancel': 'Отмена',
        'common.delete': 'Удалить',
        'common.ok': 'ОК',
        'common.close': 'Закрыть',
        'common.reset': 'Сбросить',
        'common.back': 'Назад',

        'confirm.deleteNode': 'Убрать {name} из графа? Все связи будут разорваны.',
        'confirm.deleteEdge': 'Разорвать эту связь?',
        'confirm.clear': 'Стереть весь граф? Отменить будет нельзя.',
        'confirm.forget': 'Забыть всё, что написала история? Связи, сделанные вручную, останутся.',

        'toast.synced': 'Синхронизировано: новых — {added}, всего — {total}',
        'toast.nothingNew': 'Все уже на доске.',
        'toast.groupAdded': 'Добавлено из группы: {n}',
        'toast.noGroups': 'Групп пока нет.',
        'toast.nodeRemoved': '{name} покидает доску.',

        'empty.title': 'Доска пуста',
        'empty.body': 'Синхронизируйте персонажей или добавьте NPC, чтобы начать плести связи.',
        'empty.cta': 'Синхронизировать персонажей',
        'empty.story.title': 'История ещё не началась',
        'empty.story.body': 'В режиме истории карта рисуется по ходу игры: души появляются, когда выходят на сцену, а связи вырастают из того, что происходит между ними.',
        'empty.story.cta': 'Прочитать чат',

        'group.pick': 'Выберите группу',

        'set.hint': 'Живая карта того, кто кого любит, кому доверяет и кого терпеть не может — по всем персонажам и NPC.',
        'set.lang': 'Язык',
        'set.open': 'Открыть граф',
        'set.appearance': 'Внешний вид',
        'set.fab': 'Плавающая кнопка-сердце',
        'set.anim': 'Анимации',
        'set.lite': 'Лёгкий режим',
        'set.lite.auto': 'Авто',
        'set.lite.on': 'Всегда включён',
        'set.lite.off': 'Выключен',
        'set.liteHint': 'Меньше эффектов, легче отрисовка. «Авто» включает его на сенсорных устройствах.',
        'set.labels': 'Показывать имена',
        'set.avatars': 'Показывать аватары',
        'set.curved': 'Изогнутые связи',
        'set.autosync': 'Автоматически добавлять новых персонажей',
        'set.wand': 'Показывать в меню расширений',
        'set.stats': 'душ — {nodes} · связей — {edges}',
        'set.resetPos': 'Сбросить позицию сердца',
        'set.story': 'Режим истории',
        'set.storyHint': 'Карта пишет себя сама по ходу ролевой: душа появляется, когда выходит на сцену, а каждая общая сцена продвигает связь между двумя чуть дальше.',
        'set.storyMode': 'Выращивать связи из чата',
        'set.storyCast': 'Только те, кого встретила история',
        'set.storyMentions': 'Считать имена в тексте',
        'set.storyFade': 'Остывание забытых связей',
        'set.storyPace': 'Темп',
        'set.storyRebuild': 'Перечитать чат',
        'set.storyForget': 'Забыть историю',
        'set.storyStats': 'Прочитано {read} из {total} · глава {chapter} · зреет {sparks}, сложилось {settled}',
    },
};

let current = 'en';
const listeners = new Set();

/** @returns {string} the active language id */
export function getLanguage() {
    return current;
}

/** Switches the active language and notifies subscribers. */
export function setLanguage(lang) {
    const next = DICT[lang] ? lang : 'en';
    if (next === current) return current;
    current = next;
    for (const fn of listeners) {
        try {
            fn(current);
        } catch (err) {
            console.error('[MyLove Graph] language listener failed', err);
        }
    }
    return current;
}

/** Subscribes to language changes. Returns an unsubscribe function. */
export function onLanguageChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/**
 * Translates a key, interpolating {placeholders}.
 * Falls back to English, then to the key itself.
 */
export function t(key, vars) {
    const table = DICT[current] || DICT.en;
    let value = table[key];
    if (value === undefined) value = DICT.en[key];
    if (value === undefined) return key;
    if (vars) {
        for (const name of Object.keys(vars)) {
            value = value.split('{' + name + '}').join(String(vars[name]));
        }
    }
    return value;
}

/**
 * Applies translations to a subtree.
 * Supported attributes: data-i18n, data-i18n-title, data-i18n-ph, data-i18n-aria.
 */
export function applyI18n(root) {
    if (!root) return;
    root.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
        const text = t(el.dataset.i18nTitle);
        el.title = text;
        if (!el.hasAttribute('data-i18n-aria')) el.setAttribute('aria-label', text);
    });
    root.querySelectorAll('[data-i18n-ph]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPh);
    });
    root.querySelectorAll('[data-i18n-aria]').forEach(el => {
        el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
}

/** Picks a Russian plural form: [one, few, many]. Other languages use [one, many, many]. */
export function plural(n, forms) {
    const abs = Math.abs(n) % 100;
    if (current !== 'ru') return forms[n === 1 ? 0 : 2] || forms[0];
    if (abs > 10 && abs < 20) return forms[2];
    const last = abs % 10;
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1];
    return forms[2];
}
