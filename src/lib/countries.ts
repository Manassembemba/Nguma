/**
 * Données de pays et villes pour le formulaire de profil
 * Focus sur les pays francophones d'Afrique avec liste complète de villes
 */

export interface Country {
    code: string; // Code ISO 3166-1 alpha-2
    name: string; // Nom en français
    dialCode: string; // Code téléphonique (ex: +243)
}

export interface City {
    name: string;
    countryCode: string;
}

/**
 * Liste de tous les pays en français, triés alphabétiquement
 */
export const COUNTRIES: Country[] = [
    { code: 'CD', name: 'République Démocratique du Congo', dialCode: '+243' },
    { code: 'CG', name: 'République du Congo', dialCode: '+242' },
    { code: 'BF', name: 'Burkina Faso', dialCode: '+226' },
    { code: 'CM', name: 'Cameroun', dialCode: '+237' },
    { code: 'CI', name: "Côte d'Ivoire", dialCode: '+225' },
    { code: 'SN', name: 'Sénégal', dialCode: '+221' },
    { code: 'ML', name: 'Mali', dialCode: '+223' },
    { code: 'NE', name: 'Niger', dialCode: '+227' },
    { code: 'TD', name: 'Tchad', dialCode: '+235' },
    { code: 'GA', name: 'Gabon', dialCode: '+241' },
    { code: 'BJ', name: 'Bénin', dialCode: '+229' },
    { code: 'TG', name: 'Togo', dialCode: '+228' },
    { code: 'CF', name: 'République Centrafricaine', dialCode: '+236' },
    { code: 'RW', name: 'Rwanda', dialCode: '+250' },
    { code: 'BI', name: 'Burundi', dialCode: '+257' },
    { code: 'DJ', name: 'Djibouti', dialCode: '+253' },
    { code: 'KM', name: 'Comores', dialCode: '+269' },
    { code: 'MG', name: 'Madagascar', dialCode: '+261' },
    { code: 'MU', name: 'Maurice', dialCode: '+230' },
    { code: 'SC', name: 'Seychelles', dialCode: '+248' },
    { code: 'FR', name: 'France', dialCode: '+33' },
    { code: 'BE', name: 'Belgique', dialCode: '+32' },
    { code: 'CH', name: 'Suisse', dialCode: '+41' },
    { code: 'CA', name: 'Canada', dialCode: '+1' },
    { code: 'LU', name: 'Luxembourg', dialCode: '+352' },
    { code: 'MC', name: 'Monaco', dialCode: '+377' },
    { code: 'DZ', name: 'Algérie', dialCode: '+213' },
    { code: 'MA', name: 'Maroc', dialCode: '+212' },
    { code: 'TN', name: 'Tunisie', dialCode: '+216' },
    { code: 'EG', name: 'Égypte', dialCode: '+20' },
    { code: 'ZA', name: 'Afrique du Sud', dialCode: '+27' },
    { code: 'NG', name: 'Nigéria', dialCode: '+234' },
    { code: 'GH', name: 'Ghana', dialCode: '+233' },
    { code: 'KE', name: 'Kenya', dialCode: '+254' },
    { code: 'TZ', name: 'Tanzanie', dialCode: '+255' },
    { code: 'UG', name: 'Ouganda', dialCode: '+256' },
    { code: 'ET', name: 'Éthiopie', dialCode: '+251' },
    { code: 'ZM', name: 'Zambie', dialCode: '+260' },
    { code: 'ZW', name: 'Zimbabwe', dialCode: '+263' },
    { code: 'AO', name: 'Angola', dialCode: '+244' },
    { code: 'MZ', name: 'Mozambique', dialCode: '+258' },
    { code: 'US', name: 'États-Unis', dialCode: '+1' },
    { code: 'GB', name: 'Royaume-Uni', dialCode: '+44' },
    { code: 'DE', name: 'Allemagne', dialCode: '+49' },
    { code: 'IT', name: 'Italie', dialCode: '+39' },
    { code: 'ES', name: 'Espagne', dialCode: '+34' },
    { code: 'PT', name: 'Portugal', dialCode: '+351' },
    { code: 'NL', name: 'Pays-Bas', dialCode: '+31' },
    { code: 'SE', name: 'Suède', dialCode: '+46' },
    { code: 'NO', name: 'Norvège', dialCode: '+47' },
    { code: 'DK', name: 'Danemark', dialCode: '+45' },
    { code: 'FI', name: 'Finlande', dialCode: '+358' },
    { code: 'PL', name: 'Pologne', dialCode: '+48' },
    { code: 'CZ', name: 'République Tchèque', dialCode: '+420' },
    { code: 'AT', name: 'Autriche', dialCode: '+43' },
    { code: 'GR', name: 'Grèce', dialCode: '+30' },
    { code: 'TR', name: 'Turquie', dialCode: '+90' },
    { code: 'RU', name: 'Russie', dialCode: '+7' },
    { code: 'CN', name: 'Chine', dialCode: '+86' },
    { code: 'JP', name: 'Japon', dialCode: '+81' },
    { code: 'KR', name: 'Corée du Sud', dialCode: '+82' },
    { code: 'IN', name: 'Inde', dialCode: '+91' },
    { code: 'AU', name: 'Australie', dialCode: '+61' },
    { code: 'NZ', name: 'Nouvelle-Zélande', dialCode: '+64' },
    { code: 'BR', name: 'Brésil', dialCode: '+55' },
    { code: 'AR', name: 'Argentine', dialCode: '+54' },
    { code: 'MX', name: 'Mexique', dialCode: '+52' },
    { code: 'CL', name: 'Chili', dialCode: '+56' },
    { code: 'CO', name: 'Colombie', dialCode: '+57' },
    { code: 'PE', name: 'Pérou', dialCode: '+51' },
    { code: 'VE', name: 'Venezuela', dialCode: '+58' },
    { code: 'AE', name: 'Émirats Arabes Unis', dialCode: '+971' },
    { code: 'SA', name: 'Arabie Saoudite', dialCode: '+966' },
    { code: 'IL', name: 'Israël', dialCode: '+972' },
    { code: 'LB', name: 'Liban', dialCode: '+961' },
    { code: 'JO', name: 'Jordanie', dialCode: '+962' },
].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

/**
 * Liste de villes par pays (focus sur les pays francophones africains)
 */
export const CITIES_BY_COUNTRY: Record<string, string[]> = {
    // 🇨🇩 RDC - Liste exhaustive des principales villes
    CD: [
        'Kinshasa',
        'Lubumbashi',
        'Mbuji-Mayi',
        'Kananga',
        'Kisangani',
        'Bukavu',
        'Goma',
        'Kolwezi',
        'Likasi',
        'Matadi',
        'Boma',
        'Mbandaka',
        'Kikwit',
        'Tshikapa',
        'Butembo',
        'Uvira',
        'Gemena',
        'Kalemie',
        'Bandundu',
        'Bunia',
        'Beni',
        'Isiro',
        'Kindu',
        'Kamina',
        'Ilebo',
        'Inongo',
        'Bumba',
        'Lodja',
        'Autre',
    ],

    // 🇨🇬 Congo-Brazzaville
    CG: [
        'Brazzaville',
        'Pointe-Noire',
        'Dolisie',
        'Nkayi',
        'Owando',
        'Ouesso',
        'Impfondo',
        'Djambala',
        'Madingou',
        'Autre',
    ],

    // 🇧🇫 Burkina Faso
    BF: [
        'Ouagadougou',
        'Bobo-Dioulasso',
        'Koudougou',
        'Ouahigouya',
        'Banfora',
        'Dédougou',
        'Kaya',
        'Tenkodogo',
        'Fada N\'Gourma',
        'Autre',
    ],

    // 🇨🇲 Cameroun
    CM: [
        'Yaoundé',
        'Douala',
        'Garoua',
        'Bamenda',
        'Maroua',
        'Bafoussam',
        'Ngaoundéré',
        'Bertoua',
        'Kribi',
        'Limbé',
        'Ebolowa',
        'Kumba',
        'Buea',
        'Autre',
    ],

    // 🇨🇮 Côte d'Ivoire
    CI: [
        'Abidjan',
        'Yamoussoukro',
        'Bouaké',
        'Daloa',
        'San-Pédro',
        'Korhogo',
        'Man',
        'Gagnoa',
        'Divo',
        'Abengourou',
        'Grand-Bassam',
        'Autre',
    ],

    // 🇸🇳 Sénégal
    SN: [
        'Dakar',
        'Thiès',
        'Kaolack',
        'Saint-Louis',
        'Ziguinchor',
        'Mbour',
        'Touba',
        'Rufisque',
        'Diourbel',
        'Louga',
        'Tambacounda',
        'Kolda',
        'Autre',
    ],

    // 🇲🇱 Mali
    ML: [
        'Bamako',
        'Sikasso',
        'Mopti',
        'Koutiala',
        'Kayes',
        'Ségou',
        'Gao',
        'Tombouctou',
        'Kidal',
        'Autre',
    ],

    // 🇬🇦 Gabon
    GA: [
        'Libreville',
        'Port-Gentil',
        'Franceville',
        'Oyem',
        'Moanda',
        'Mouila',
        'Lambaréné',
        'Tchibanga',
        'Autre',
    ],

    // 🇧🇯 Bénin
    BJ: [
        'Cotonou',
        'Porto-Novo',
        'Parakou',
        'Djougou',
        'Bohicon',
        'Kandi',
        'Abomey',
        'Natitingou',
        'Autre',
    ],

    // 🇹🇬 Togo
    TG: [
        'Lomé',
        'Sokodé',
        'Kara',
        'Atakpamé',
        'Palimé',
        'Dapaong',
        'Tsévié',
        'Autre',
    ],

    // 🇫🇷 France - Principales villes
    FR: [
        'Paris',
        'Marseille',
        'Lyon',
        'Toulouse',
        'Nice',
        'Nantes',
        'Strasbourg',
        'Montpellier',
        'Bordeaux',
        'Lille',
        'Rennes',
        'Reims',
        'Le Havre',
        'Saint-Étienne',
        'Toulon',
        'Grenoble',
        'Dijon',
        'Angers',
        'Nîmes',
        'Villeurbanne',
        'Autre',
    ],

    // 🇧🇪 Belgique
    BE: [
        'Bruxelles',
        'Anvers',
        'Gand',
        'Charleroi',
        'Liège',
        'Bruges',
        'Namur',
        'Louvain',
        'Mons',
        'Autre',
    ],

    // 🇨🇦 Canada - Principales villes
    CA: [
        'Toronto',
        'Montréal',
        'Vancouver',
        'Calgary',
        'Edmonton',
        'Ottawa',
        'Québec',
        'Winnipeg',
        'Hamilton',
        'Kitchener',
        'Autre',
    ],

    // Default: Option "Autre" pour les pays sans liste spécifique
};

/**
 * Récupère le nom d'un pays à partir de son code ISO
 */
export const getCountryName = (code: string): string => {
    const country = COUNTRIES.find(c => c.code === code);
    return country?.name || code;
};

/**
 * Récupère le code téléphonique d'un pays à partir de son code ISO
 */
export const getCountryDialCode = (code: string): string => {
    const country = COUNTRIES.find(c => c.code === code);
    return country?.dialCode || '';
};

/**
 * Récupère la liste des villes pour un pays donné
 */
export const getCitiesByCountry = (countryCode: string): string[] => {
    return CITIES_BY_COUNTRY[countryCode] || ['Autre'];
};

/**
 * Vérifie si un pays a une liste de villes spécifique
 */
export const hasCustomCities = (countryCode: string): boolean => {
    return countryCode in CITIES_BY_COUNTRY;
};

/**
 * Liste de tous les codes de pays
 */
export const COUNTRY_CODES = COUNTRIES.map(c => c.code);
