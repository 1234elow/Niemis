const BARBADOS_ZONE_DEFINITIONS = [
    {
        key: 'zone_1',
        name: 'Zone 1',
        description: 'Northern and western catchment for secondary placement.'
    },
    {
        key: 'zone_2',
        name: 'Zone 2',
        description: 'Central and inland catchment for secondary placement.'
    },
    {
        key: 'zone_3',
        name: 'Zone 3',
        description: 'Southern and eastern catchment for secondary placement.'
    }
];

const normalizeText = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const normalizeParishCode = (value) => {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return null;
    if (raw === 'STM' || raw === 'ST THOMAS') return 'ST';
    if (raw === 'SJOSEPH') return 'SJO';
    if (raw === 'SJOHN') return 'SJN';
    if (raw === 'SPHILIP') return 'SPH';
    if (raw === 'SMICHAEL') return 'SM';
    return raw;
};

const resolveParishCode = ({ parishCode, parishName, schoolParish }) => {
    const directCode = normalizeParishCode(parishCode);
    if (directCode) return directCode;

    const normalizedParishName = normalizeText(parishName || schoolParish);
    const parishMap = {
        'christ church': 'CC',
        'st andrew': 'SA',
        'saint andrew': 'SA',
        'st george': 'SG',
        'saint george': 'SG',
        'st james': 'SJ',
        'saint james': 'SJ',
        'st john': 'SJN',
        'saint john': 'SJN',
        'st joseph': 'SJO',
        'saint joseph': 'SJO',
        'st lucy': 'SL',
        'saint lucy': 'SL',
        'st michael': 'SM',
        'saint michael': 'SM',
        'st peter': 'SP',
        'saint peter': 'SP',
        'st philip': 'SPH',
        'saint philip': 'SPH',
        'st thomas': 'ST',
        'saint thomas': 'ST'
    };

    if (parishMap[normalizedParishName]) {
        return parishMap[normalizedParishName];
    }

    const schoolParishRaw = String(schoolParish || '').trim().toLowerCase();
    const enumParishMap = {
        st_michael: 'SM',
        christ_church: 'CC',
        st_philip: 'SPH',
        st_james: 'SJ',
        st_john: 'SJN',
        st_andrew: 'SA',
        st_george: 'SG',
        st_peter: 'SP',
        st_lucy: 'SL'
    };
    return enumParishMap[schoolParishRaw] || null;
};

const SECONDARY_ZONE_SCHOOL_NAMES = {
    zone_1: [
        'alexandra',
        'coleridge and parry',
        'daryll jordan',
        'darryl jordan',
        'frederick smith',
        'ellerslie',
        'queens college',
        'queen s college'
    ],
    zone_2: [
        'alleyne',
        'combermere',
        'grantley adams',
        'harrison college',
        'parkinson',
        'st george secondary',
        'lester vaughan',
        'lester vaughn'
    ],
    zone_3: [
        'christ church foundation',
        'deighton griffith',
        'graydon sealy',
        'lodge',
        'princess margaret',
        'st michael school',
        'the st michael school'
    ]
};

const PARISH_ZONE_MAP = {
    zone_1: new Set(['SL', 'SP', 'SJ']),
    zone_2: new Set(['SA', 'SJO', 'SG', 'ST', 'SM']),
    zone_3: new Set(['CC', 'SJN', 'SPH'])
};

const resolveZoneKeyBySchoolName = (schoolName) => {
    const normalizedSchoolName = normalizeText(schoolName);
    if (!normalizedSchoolName) return null;

    if (
        normalizedSchoolName.includes('springer memorial') ||
        normalizedSchoolName.includes('st leonard')
    ) {
        return null;
    }

    const zoneEntry = Object.entries(SECONDARY_ZONE_SCHOOL_NAMES).find(([, names]) =>
        names.some((nameToken) => normalizedSchoolName.includes(nameToken))
    );
    return zoneEntry ? zoneEntry[0] : null;
};

const resolveBarbadosZoneKeyForSchool = ({
    schoolName,
    schoolType,
    parishCode,
    parishName,
    schoolParish
}) => {
    const normalizedType = normalizeText(schoolType);
    if (normalizedType.includes('secondary')) {
        const zoneByName = resolveZoneKeyBySchoolName(schoolName);
        if (zoneByName) return zoneByName;
    }

    const resolvedParishCode = resolveParishCode({
        parishCode,
        parishName,
        schoolParish
    });
    if (!resolvedParishCode) return null;

    const zoneEntry = Object.entries(PARISH_ZONE_MAP).find(([, parishSet]) =>
        parishSet.has(resolvedParishCode)
    );
    return zoneEntry ? zoneEntry[0] : null;
};

const getZoneDefinitionByKey = (zoneKey) =>
    BARBADOS_ZONE_DEFINITIONS.find((zone) => zone.key === zoneKey) || null;

const getZoneNameByKey = (zoneKey) =>
    getZoneDefinitionByKey(zoneKey)?.name || null;

module.exports = {
    BARBADOS_ZONE_DEFINITIONS,
    resolveParishCode,
    resolveBarbadosZoneKeyForSchool,
    getZoneDefinitionByKey,
    getZoneNameByKey
};
