export type LicenseAttribution = {
    usage: string;
    text: string;
    href: string;
    title: string;
};

export type LicenseItem = {
    provider: string;
    description: string;
    attributions: LicenseAttribution[];
};

export const LICENSE_ITEMS: LicenseItem[] = [
    {
        provider: "Flaticon",
        description: "우리리그 서비스에서 사용되는 일부 아이콘은 Flaticon에서 제공하는 리소스를 사용하고 있습니다.",
        attributions: [
            {
                usage: "사용 아이콘: 이메일, 문서, 자동, 스마트폰, 축포",
                text: "Icons created by Magnific, Slidicon, Iconjam and surang - Flaticon",
                href: "https://www.flaticon.com/kr/free-icons/-",
                title: "Flaticon 아이콘 저작자 표시",
            },
        ],
    },
];
