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

        'tb.ai': 'Director',
        'tb.board': 'Board',

        'ai.title': 'Director',
        'ai.enable': 'Let a model write the map',
        'ai.hint': 'A model reads the roleplay as it happens and writes the map itself: who walked into the story, what they are like, and what is going on between them. Everything it knows comes from this chat.',
        'ai.auto': 'Read new scenes by itself',
        'ai.source': 'Which model writes it',
        'ai.source.main': 'Main connection',
        'ai.source.profile': 'Separate profile',
        'ai.source.custom': 'Custom endpoint',
        'ai.sourceHint': 'The main connection is the one telling the story. A separate profile lets a small, fast model keep the map while your good one stays free for the roleplay.',
        'ai.profile': 'Connection profile',
        'ai.profilePick': 'Pick a profile…',
        'ai.profileHint': 'Profiles come from SillyTavern\u2019s Connection Manager \u2014 API, model and preset in one.',
        'ai.noProfiles': 'This SillyTavern build has no connection profiles.',
        'ai.usePreset': 'Use the profile\u2019s own preset and instruct',
        'ai.url': 'Endpoint URL',
        'ai.urlPh': 'http://localhost:11434/v1',
        'ai.key': 'API key',
        'ai.keyPh': 'optional, kept in your ST settings',
        'ai.model': 'Model',
        'ai.modelPh': 'model name',
        'ai.customHint': 'Any OpenAI-compatible endpoint. It has to accept requests from this page (CORS), and the key is stored in plain SillyTavern settings \u2014 use a local backend or a key you can revoke.',
        'ai.target': 'Writing with: {target}',
        'ai.every': 'Read every N messages',
        'ai.window': 'Messages per pass',
        'ai.depth': 'Re-read depth',
        'ai.maxTokens': 'Answer budget',
        'ai.maxNew': 'New souls per pass',
        'ai.writes': 'What it may write',
        'ai.newSouls': 'Bring in new souls',
        'ai.newBonds': 'Draw new bonds',
        'ai.profiles': 'Write roles and profiles',
        'ai.lang': 'Writes in',
        'ai.lang.auto': 'Interface language',
        'ai.analyze': 'Read the new scenes',
        'ai.rebuild': 'Re-read this chat',
        'ai.forget': 'Forget what it wrote',
        'ai.test': 'Test the connection',
        'ai.stop': 'Stop',
        'ai.testing': 'Knocking on the model\u2019s door…',
        'ai.testOk': 'It answered. Writing with: {target}',
        'ai.testFail': 'No luck: {error}',
        'ai.reading': 'Reading the scenes…',
        'ai.rebuilding': 'Re-reading: pass {done} of {of}…',
        'ai.done': '+{souls} souls, +{bonds} bonds, {changed} rewritten',
        'ai.nothing': 'Nothing new to read.',
        'ai.failed': 'The director stumbled: {error}',
        'ai.notReady': 'The director has nowhere to send its request yet.',
        'ai.stats': 'Read {read} of {total} · {runs} passes · it wrote {souls} souls and {bonds} bonds',
        'ai.log': 'Story log',
        'ai.logEmpty': 'Nothing written down yet.',
        'ai.dossier': 'Write a dossier',
        'ai.dossierBusy': 'Reading their scenes…',
        'ai.dossierDone': 'Dossier written for {name}.',
        'ai.confirmRebuild': 'Re-read this chat with the model? That is about {n} requests.',
        'ai.confirmForget': 'Forget everything the director wrote here? Your own bonds stay.',
        'ai.reason.noProfiles': 'this SillyTavern build has no connection profiles',
        'ai.reason.noProfile': 'no connection profile picked',
        'ai.reason.goneProfile': 'that connection profile is gone',
        'ai.reason.noUrl': 'no endpoint URL',
        'ai.reason.noModel': 'no model name',
        'ai.reason.noHost': 'SillyTavern is not reachable from here',

        'hud.director': 'DIRECTOR',
        'hud.aiSouls': '{n} written',
        'hud.aiPending': '{n} unread',

        'insp.bio': 'What the story says',
        'insp.traits': 'Traits',
        'insp.dossier': 'Dossier',
        'insp.appearance': 'Appearance',
        'insp.personality': 'Personality',
        'insp.goal': 'Wants',
        'insp.secret': 'Keeps to themselves',
        'insp.voice': 'Voice',
        'insp.byAi': 'director',

        'set.ai': 'Director',
        'set.scope': 'A board for every chat',
        'set.scopeHint': 'Each roleplay writes its own map, so one story\u2019s cast never wanders into another. Off: one shared board for everything.',
        'set.copyBoard': 'Copy the shared board into this chat',
        'board.chat': 'This chat\u2019s board',
        'board.global': 'Shared board',
        'confirm.copyBoard': 'Copy the shared board into this chat?',
        'toast.copied': 'Copied: {nodes} souls, {edges} bonds.',
        'toast.noChat': 'Open a chat first.',
        'empty.ai.cta': 'Let the director read it',
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

        'tb.ai': 'Режиссёр',
        'tb.board': 'Доска',

        'ai.title': 'Режиссёр',
        'ai.enable': 'Пусть карту пишет модель',
        'ai.hint': 'Модель читает ролевую по ходу дела и сама составляет карту: кто вошёл в историю, какие они и что между ними происходит. Всё, что она знает, взято из этого чата.',
        'ai.auto': 'Читать новые сцены самому',
        'ai.source': 'Какая модель пишет',
        'ai.source.main': 'Основное подключение',
        'ai.source.profile': 'Отдельный профиль',
        'ai.source.custom': 'Свой эндпоинт',
        'ai.sourceHint': 'Основное подключение — то, которым вы ведёте историю. Отдельный профиль позволяет держать карту маленькой быстрой моделью, пока главная занята ролевой.',
        'ai.profile': 'Профиль подключения',
        'ai.profilePick': 'Выберите профиль…',
        'ai.profileHint': 'Профили берутся из «Connection Manager» SillyTavern — API, модель и пресет разом.',
        'ai.noProfiles': 'В этой сборке SillyTavern профилей подключения нет.',
        'ai.usePreset': 'Использовать пресет и instruct профиля',
        'ai.url': 'URL эндпоинта',
        'ai.urlPh': 'http://localhost:11434/v1',
        'ai.key': 'API-ключ',
        'ai.keyPh': 'необязательно, хранится в настройках ST',
        'ai.model': 'Модель',
        'ai.modelPh': 'название модели',
        'ai.customHint': 'Любой OpenAI-совместимый эндпоинт. Он должен принимать запросы с этой страницы (CORS), а ключ хранится в настройках SillyTavern как есть — берите локальный бэкенд или ключ, который не жалко отозвать.',
        'ai.target': 'Пишет через: {target}',
        'ai.every': 'Читать каждые N сообщений',
        'ai.window': 'Сообщений за проход',
        'ai.depth': 'Глубина перечитывания',
        'ai.maxTokens': 'Бюджет ответа',
        'ai.maxNew': 'Новых душ за проход',
        'ai.writes': 'Что ему можно писать',
        'ai.newSouls': 'Вводить новых персонажей',
        'ai.newBonds': 'Рисовать новые связи',
        'ai.profiles': 'Писать роли и досье',
        'ai.lang': 'Пишет на',
        'ai.lang.auto': 'Язык интерфейса',
        'ai.analyze': 'Прочитать новые сцены',
        'ai.rebuild': 'Перечитать этот чат',
        'ai.forget': 'Забыть написанное',
        'ai.test': 'Проверить подключение',
        'ai.stop': 'Остановить',
        'ai.testing': 'Стучимся к модели…',
        'ai.testOk': 'Ответила. Пишет через: {target}',
        'ai.testFail': 'Не вышло: {error}',
        'ai.reading': 'Читаю сцены…',
        'ai.rebuilding': 'Перечитываю: проход {done} из {of}…',
        'ai.done': '+{souls} душ, +{bonds} связей, {changed} переписано',
        'ai.nothing': 'Читать пока нечего.',
        'ai.failed': 'Режиссёр споткнулся: {error}',
        'ai.notReady': 'Режиссёру пока некуда отправлять запрос.',
        'ai.stats': 'Прочитано {read} из {total} · проходов: {runs} · написано душ: {souls}, связей: {bonds}',
        'ai.log': 'Летопись',
        'ai.logEmpty': 'Пока ничего не записано.',
        'ai.dossier': 'Написать досье',
        'ai.dossierBusy': 'Читаю их сцены…',
        'ai.dossierDone': 'Досье на {name} написано.',
        'ai.confirmRebuild': 'Перечитать этот чат моделью? Это примерно {n} запросов.',
        'ai.confirmForget': 'Забыть всё, что режиссёр здесь написал? Ваши собственные связи останутся.',
        'ai.reason.noProfiles': 'в этой сборке SillyTavern нет профилей подключения',
        'ai.reason.noProfile': 'профиль подключения не выбран',
        'ai.reason.goneProfile': 'этот профиль подключения исчез',
        'ai.reason.noUrl': 'не указан URL эндпоинта',
        'ai.reason.noModel': 'не указана модель',
        'ai.reason.noHost': 'SillyTavern отсюда недоступен',

        'hud.director': 'РЕЖИССЁР',
        'hud.aiSouls': '{n} написано',
        'hud.aiPending': '{n} не прочитано',

        'insp.bio': 'Что говорит история',
        'insp.traits': 'Черты',
        'insp.dossier': 'Досье',
        'insp.appearance': 'Внешность',
        'insp.personality': 'Характер',
        'insp.goal': 'Чего хочет',
        'insp.secret': 'Что скрывает',
        'insp.voice': 'Голос',
        'insp.byAi': 'режиссёр',

        'set.ai': 'Режиссёр',
        'set.scope': 'Своя доска для каждого чата',
        'set.scopeHint': 'Каждая ролевая пишет собственную карту, и состав одной истории не забредает в другую. Выключено — одна общая доска на всё.',
        'set.copyBoard': 'Скопировать общую доску в этот чат',
        'board.chat': 'Доска этого чата',
        'board.global': 'Общая доска',
        'confirm.copyBoard': 'Скопировать общую доску в этот чат?',
        'toast.copied': 'Скопировано: {nodes} душ, {edges} связей.',
        'toast.noChat': 'Сначала откройте чат.',
        'empty.ai.cta': 'Пусть прочитает режиссёр',
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
