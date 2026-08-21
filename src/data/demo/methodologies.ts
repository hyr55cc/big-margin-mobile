/* =========================================================================
   Shariah screening methodologies — reference descriptions

   The thresholds recorded here are the widely published screening criteria
   associated with each body. They are stored as reference material for the
   methodology pages; BIG MARGIN neither issues nor endorses any ruling, and
   the authoritative statement of any methodology is the body's own current
   publication, linked from each entry.
   ========================================================================= */

import type { ShariahMethodology } from '@/types';

export const METHODOLOGIES: ShariahMethodology[] = [
  {
    id: 'aaoifi',
    shortName: 'AAOIFI',
    name: {
      ar: 'هيئة المحاسبة والمراجعة للمؤسسات المالية الإسلامية',
      en: 'Accounting and Auditing Organization for Islamic Financial Institutions',
    },
    description: {
      ar: 'معيار الشريعة رقم ٢١ الخاص بالأوراق المالية، ويعتمد على نسب مالية مرتبطة بالقيمة السوقية إلى جانب ضوابط النشاط الأساسي للشركة.',
      en: 'Shariah Standard No. 21 on financial paper, combining activity screens with financial ratios measured against market capitalisation.',
    },
    rules: [
      {
        key: 'activity',
        label: { ar: 'ضابط النشاط', en: 'Activity screen' },
        threshold: '—',
        basis: {
          ar: 'استبعاد الشركات التي يكون نشاطها الأساسي محرمًا، مثل الربا والميسر والخمر والتبغ والترفيه المحرم.',
          en: 'Excludes companies whose core business is impermissible, including interest-based finance, gambling, alcohol, tobacco and impermissible entertainment.',
        },
      },
      {
        key: 'debt',
        label: { ar: 'نسبة الاقتراض بفائدة', en: 'Interest-bearing debt ratio' },
        threshold: '< 30%',
        basis: {
          ar: 'إجمالي الاقتراض بفائدة ÷ القيمة السوقية.',
          en: 'Total interest-bearing debt ÷ market capitalisation.',
        },
      },
      {
        key: 'liquid',
        label: { ar: 'النقد والاستثمارات بفائدة', en: 'Cash and interest-bearing investments' },
        threshold: '< 30%',
        basis: {
          ar: 'النقد والودائع والأوراق المالية ذات العائد الربوي ÷ القيمة السوقية.',
          en: 'Cash, deposits and interest-bearing securities ÷ market capitalisation.',
        },
      },
      {
        key: 'income',
        label: { ar: 'الإيراد غير المتوافق', en: 'Non-permissible income' },
        threshold: '< 5%',
        basis: {
          ar: 'الإيراد من مصادر غير متوافقة ÷ إجمالي الإيرادات، مع وجوب تطهير ما يقابله.',
          en: 'Income from non-permissible sources ÷ total revenue, with purification of the corresponding amount required.',
        },
      },
    ],
    sourceName: 'AAOIFI Shariah Standards',
    sourceUrl: 'https://aaoifi.com/shariaa-standards/?lang=en',
    lastUpdated: '2026-01-01',
  },
  {
    id: 'sp',
    shortName: 'S&P Shariah',
    name: {
      ar: 'منهجية مؤشرات ستاندرد آند بورز المتوافقة مع الشريعة',
      en: 'S&P Dow Jones Shariah Indices Methodology',
    },
    description: {
      ar: 'منهجية مؤشرات ستاندرد آند بورز الشرعية، وتستخدم متوسط القيمة السوقية على ٣٦ شهرًا كمقام في النسب المالية.',
      en: 'The S&P Shariah index family, which uses a 36-month average market capitalisation as the denominator in its financial ratios.',
    },
    rules: [
      {
        key: 'activity',
        label: { ar: 'ضابط النشاط', en: 'Activity screen' },
        threshold: '—',
        basis: {
          ar: 'استبعاد الأنشطة غير المتوافقة كالخدمات المالية الربوية والكحول والتبغ ولحم الخنزير والأسلحة والإعلام المحرم.',
          en: 'Excludes non-compliant business lines including conventional financials, alcohol, tobacco, pork, weapons and impermissible media.',
        },
      },
      {
        key: 'debt',
        label: { ar: 'نسبة الديون', en: 'Debt ratio' },
        threshold: '< 33%',
        basis: {
          ar: 'إجمالي الديون ÷ متوسط القيمة السوقية لـ ٣٦ شهرًا.',
          en: 'Total debt ÷ 36-month average market capitalisation.',
        },
      },
      {
        key: 'liquid',
        label: { ar: 'النقد والأوراق بفائدة', en: 'Cash and interest-bearing securities' },
        threshold: '< 33%',
        basis: {
          ar: 'النقد والأوراق المالية ذات الفائدة ÷ متوسط القيمة السوقية لـ ٣٦ شهرًا.',
          en: 'Cash plus interest-bearing securities ÷ 36-month average market capitalisation.',
        },
      },
      {
        key: 'receivables',
        label: { ar: 'الذمم المدينة', en: 'Accounts receivable' },
        threshold: '< 49%',
        basis: {
          ar: 'الذمم المدينة ÷ متوسط القيمة السوقية لـ ٣٦ شهرًا.',
          en: 'Accounts receivable ÷ 36-month average market capitalisation.',
        },
      },
      {
        key: 'income',
        label: { ar: 'الإيراد غير المتوافق', en: 'Non-permissible income' },
        threshold: '< 5%',
        basis: {
          ar: 'الإيراد غير المتوافق ÷ إجمالي الإيرادات.',
          en: 'Non-permissible income ÷ total revenue.',
        },
      },
    ],
    sourceName: 'S&P Dow Jones Indices',
    sourceUrl: 'https://www.spglobal.com/spdji/en/documents/methodologies/methodology-sp-shariah-indices.pdf',
    lastUpdated: '2026-01-01',
  },
  {
    id: 'djim',
    shortName: 'DJIM',
    name: {
      ar: 'مؤشرات داو جونز الإسلامية',
      en: 'Dow Jones Islamic Market Indices',
    },
    description: {
      ar: 'منهجية مؤشرات داو جونز الإسلامية، ويشرف عليها مجلس رقابة شرعي مستقل، وتستخدم متوسط القيمة السوقية على ٢٤ شهرًا.',
      en: 'The Dow Jones Islamic Market methodology, supervised by an independent Shariah board, using a 24-month average market capitalisation.',
    },
    rules: [
      {
        key: 'activity',
        label: { ar: 'ضابط النشاط', en: 'Activity screen' },
        threshold: '—',
        basis: {
          ar: 'استبعاد قطاعات الكحول والتبغ ولحم الخنزير والخدمات المالية التقليدية والأسلحة والدفاع والترفيه المحرم.',
          en: 'Excludes alcohol, tobacco, pork, conventional financial services, weapons and defence, and impermissible entertainment.',
        },
      },
      {
        key: 'debt',
        label: { ar: 'نسبة الديون', en: 'Debt ratio' },
        threshold: '< 33%',
        basis: {
          ar: 'إجمالي الديون ÷ متوسط القيمة السوقية لـ ٢٤ شهرًا.',
          en: 'Total debt ÷ 24-month average market capitalisation.',
        },
      },
      {
        key: 'liquid',
        label: { ar: 'النقد والأوراق بفائدة', en: 'Cash and interest-bearing securities' },
        threshold: '< 33%',
        basis: {
          ar: 'النقد والأوراق ذات الفائدة ÷ متوسط القيمة السوقية لـ ٢٤ شهرًا.',
          en: 'Cash plus interest-bearing securities ÷ 24-month average market capitalisation.',
        },
      },
      {
        key: 'receivables',
        label: { ar: 'الذمم المدينة', en: 'Accounts receivable' },
        threshold: '< 33%',
        basis: {
          ar: 'الذمم المدينة ÷ متوسط القيمة السوقية لـ ٢٤ شهرًا.',
          en: 'Accounts receivable ÷ 24-month average market capitalisation.',
        },
      },
    ],
    sourceName: 'S&P Dow Jones Indices — DJIM',
    sourceUrl: 'https://www.spglobal.com/spdji/en/index-family/equity/shariah/dow-jones-islamic-market/',
    lastUpdated: '2026-01-01',
  },
];

export const DEFAULT_METHODOLOGY_ID = 'aaoifi';
