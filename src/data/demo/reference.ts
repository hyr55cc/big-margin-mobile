/* =========================================================================
   ⚠️  DEMO REFERENCE DATA — NOT PRODUCTION MARKET DATA  ⚠️

   This file holds identity information only: exchange symbol, company name in
   Arabic and English, and sector classification. No prices, market caps,
   index weights, financial ratios or Shariah classifications appear here.

   Everything numeric in the demo dataset is produced by a clearly-labelled
   synthetic generator (./generate.ts) so that no figure in this repository can
   be mistaken for a real market observation.
   ========================================================================= */

import type { MarketId } from '@/types';

export interface RefInstrument {
  symbol: string;
  market: MarketId;
  ar: string;
  en: string;
  shortAr: string;
  shortEn: string;
  sectorId: string;
  indices: string[];
}

export interface RefSector {
  id: string;
  market: MarketId;
  ar: string;
  en: string;
}

export const DEMO_SECTORS: RefSector[] = [
  // Saudi (TASI) sectors
  { id: 'sa-energy', market: 'SA', ar: 'الطاقة', en: 'Energy' },
  { id: 'sa-materials', market: 'SA', ar: 'المواد الأساسية', en: 'Materials' },
  { id: 'sa-capgoods', market: 'SA', ar: 'السلع الرأسمالية', en: 'Capital Goods' },
  { id: 'sa-transport', market: 'SA', ar: 'النقل', en: 'Transportation' },
  { id: 'sa-consumerserv', market: 'SA', ar: 'الخدمات الاستهلاكية', en: 'Consumer Services' },
  { id: 'sa-retail', market: 'SA', ar: 'التجزئة', en: 'Retailing' },
  { id: 'sa-staples', market: 'SA', ar: 'تجزئة الأغذية', en: 'Consumer Staples Distribution' },
  { id: 'sa-food', market: 'SA', ar: 'إنتاج الأغذية', en: 'Food & Beverages' },
  { id: 'sa-health', market: 'SA', ar: 'الرعاية الصحية', en: 'Health Care' },
  { id: 'sa-banks', market: 'SA', ar: 'البنوك', en: 'Banks' },
  { id: 'sa-finserv', market: 'SA', ar: 'الخدمات المالية', en: 'Financial Services' },
  { id: 'sa-insurance', market: 'SA', ar: 'التأمين', en: 'Insurance' },
  { id: 'sa-telecom', market: 'SA', ar: 'الاتصالات', en: 'Telecommunication Services' },
  { id: 'sa-utilities', market: 'SA', ar: 'المرافق العامة', en: 'Utilities' },
  { id: 'sa-reits', market: 'SA', ar: 'صناديق الريت', en: 'REITs' },
  { id: 'sa-realestate', market: 'SA', ar: 'إدارة وتطوير العقارات', en: 'Real Estate Management' },
  { id: 'sa-software', market: 'SA', ar: 'البرمجيات والخدمات', en: 'Software & Services' },

  // US sectors (GICS level 1)
  { id: 'us-tech', market: 'US', ar: 'تقنية المعلومات', en: 'Information Technology' },
  { id: 'us-health', market: 'US', ar: 'الرعاية الصحية', en: 'Health Care' },
  { id: 'us-financials', market: 'US', ar: 'القطاع المالي', en: 'Financials' },
  { id: 'us-discretionary', market: 'US', ar: 'السلع الكمالية', en: 'Consumer Discretionary' },
  { id: 'us-comm', market: 'US', ar: 'خدمات الاتصالات', en: 'Communication Services' },
  { id: 'us-industrials', market: 'US', ar: 'الصناعات', en: 'Industrials' },
  { id: 'us-staples', market: 'US', ar: 'السلع الأساسية', en: 'Consumer Staples' },
  { id: 'us-energy', market: 'US', ar: 'الطاقة', en: 'Energy' },
  { id: 'us-utilities', market: 'US', ar: 'المرافق', en: 'Utilities' },
  { id: 'us-realestate', market: 'US', ar: 'العقارات', en: 'Real Estate' },
  { id: 'us-materials', market: 'US', ar: 'المواد', en: 'Materials' },
];

const SA = (
  symbol: string,
  ar: string,
  en: string,
  sectorId: string,
  shortAr?: string,
  shortEn?: string,
): RefInstrument => ({
  symbol,
  market: 'SA',
  ar,
  en,
  shortAr: shortAr ?? ar,
  shortEn: shortEn ?? en,
  sectorId,
  indices: ['TASI'],
});

const US = (
  symbol: string,
  ar: string,
  en: string,
  sectorId: string,
  indices: string[] = ['SPX'],
): RefInstrument => ({
  symbol,
  market: 'US',
  ar,
  en,
  shortAr: ar,
  shortEn: en,
  sectorId,
  indices,
});

export const DEMO_INSTRUMENTS: RefInstrument[] = [
  /* ------------------------------ Saudi ------------------------------ */
  SA('2222', 'أرامكو السعودية', 'Saudi Arabian Oil Co.', 'sa-energy', 'أرامكو', 'Saudi Aramco'),
  SA('1120', 'مصرف الراجحي', 'Al Rajhi Bank', 'sa-banks', 'الراجحي', 'Al Rajhi'),
  SA('1180', 'البنك الأهلي السعودي', 'Saudi National Bank', 'sa-banks', 'الأهلي', 'SNB'),
  SA('2010', 'الشركة السعودية للصناعات الأساسية', 'Saudi Basic Industries Corp.', 'sa-materials', 'سابك', 'SABIC'),
  SA('7010', 'شركة الاتصالات السعودية', 'Saudi Telecom Co.', 'sa-telecom', 'الاتصالات', 'stc'),
  SA('1211', 'شركة التعدين العربية السعودية', 'Saudi Arabian Mining Co.', 'sa-materials', 'معادن', 'Maaden'),
  SA('2082', 'شركة أكوا باور', 'ACWA Power Co.', 'sa-utilities', 'أكوا باور', 'ACWA Power'),
  SA('1010', 'بنك الرياض', 'Riyad Bank', 'sa-banks'),
  SA('1150', 'مصرف الإنماء', 'Alinma Bank', 'sa-banks'),
  SA('1060', 'البنك السعودي الأول', 'Saudi Awwal Bank', 'sa-banks', 'السعودي الأول', 'SAB'),
  SA('1050', 'البنك السعودي الفرنسي', 'Banque Saudi Fransi', 'sa-banks', 'الفرنسي', 'BSF'),
  SA('1080', 'البنك العربي الوطني', 'Arab National Bank', 'sa-banks', 'العربي الوطني', 'ANB'),
  SA('1020', 'بنك الجزيرة', 'Bank AlJazira', 'sa-banks'),
  SA('1030', 'البنك السعودي للاستثمار', 'Saudi Investment Bank', 'sa-banks', 'الاستثمار', 'SAIB'),
  SA('5110', 'الشركة السعودية للكهرباء', 'Saudi Electricity Co.', 'sa-utilities', 'كهرباء السعودية', 'Saudi Electricity'),
  SA('2280', 'شركة المراعي', 'Almarai Co.', 'sa-food', 'المراعي', 'Almarai'),
  SA('2050', 'مجموعة صافولا', 'Savola Group', 'sa-food', 'صافولا', 'Savola'),
  SA('6010', 'الشركة الوطنية للتنمية الزراعية', 'National Agricultural Development Co.', 'sa-food', 'نادك', 'NADEC'),
  SA('2270', 'الشركة السعودية لمنتجات الألبان والأغذية', 'Saudia Dairy & Foodstuff Co.', 'sa-food', 'سدافكو', 'SADAFCO'),
  SA('6070', 'شركة الجوف الزراعية', 'Al Jouf Agricultural Development Co.', 'sa-food', 'الجوف', 'Al Jouf'),
  SA('4013', 'شركة د. سليمان الحبيب للخدمات الطبية', 'Dr. Sulaiman Al Habib Medical Services', 'sa-health', 'د. سليمان الحبيب', 'Al Habib'),
  SA('4002', 'شركة المواساة للخدمات الطبية', 'Mouwasat Medical Services', 'sa-health', 'المواساة', 'Mouwasat'),
  SA('4004', 'شركة دله للخدمات الصحية', 'Dallah Healthcare Co.', 'sa-health', 'دله الصحية', 'Dallah Health'),
  SA('4005', 'شركة رعاية', 'National Medical Care Co.', 'sa-health', 'رعاية', 'Care'),
  SA('2380', 'شركة رابغ للتكرير والبتروكيماويات', 'Rabigh Refining & Petrochemical Co.', 'sa-energy', 'بترو رابغ', 'Petro Rabigh'),
  SA('2030', 'المصافي العربية السعودية', 'Saudi Arabia Refineries Co.', 'sa-energy', 'المصافي', 'SARCO'),
  SA('4200', 'شركة الدريس للخدمات البترولية', 'Aldrees Petroleum & Transport', 'sa-energy', 'الدريس', 'Aldrees'),
  SA('2020', 'سابك للمغذيات الزراعية', 'SABIC Agri-Nutrients Co.', 'sa-materials', 'سابك للمغذيات', 'SABIC AN'),
  SA('2290', 'شركة ينبع الوطنية للبتروكيماويات', 'Yanbu National Petrochemical Co.', 'sa-materials', 'ينساب', 'Yansab'),
  SA('2310', 'الشركة السعودية العالمية للبتروكيماويات', 'Sahara International Petrochemical Co.', 'sa-materials', 'سبكيم العالمية', 'Sipchem'),
  SA('2330', 'الشركة المتقدمة للبتروكيماويات', 'Advanced Petrochemical Co.', 'sa-materials', 'المتقدمة', 'Advanced'),
  SA('2350', 'شركة كيان السعودية للبتروكيماويات', 'Saudi Kayan Petrochemical Co.', 'sa-materials', 'كيان السعودية', 'Saudi Kayan'),
  SA('2060', 'الشركة السعودية للتصنيع', 'National Industrialization Co.', 'sa-materials', 'التصنيع', 'Tasnee'),
  SA('2250', 'المجموعة السعودية للاستثمار الصناعي', 'Saudi Industrial Investment Group', 'sa-materials', 'المجموعة السعودية', 'SIIG'),
  SA('1202', 'شركة الشرق الأوسط لصناعة وإنتاج الورق', 'Middle East Paper Co.', 'sa-materials', 'ورق', 'MEPCO'),
  SA('3030', 'شركة أسمنت السعودية', 'Saudi Cement Co.', 'sa-materials', 'أسمنت السعودية', 'Saudi Cement'),
  SA('3020', 'شركة أسمنت اليمامة', 'Yamama Cement Co.', 'sa-materials', 'أسمنت اليمامة', 'Yamama Cement'),
  SA('3010', 'شركة الأسمنت العربية', 'Arabian Cement Co.', 'sa-materials', 'أسمنت العربية', 'Arabian Cement'),
  SA('4030', 'الشركة الوطنية السعودية للنقل البحري', 'National Shipping Co. of Saudi Arabia', 'sa-transport', 'البحري', 'Bahri'),
  SA('4031', 'الشركة السعودية للخدمات الأرضية', 'Saudi Ground Services Co.', 'sa-transport', 'الخدمات الأرضية', 'SGS'),
  SA('4260', 'شركة بدجت السعودية لتأجير السيارات', 'United International Transportation', 'sa-transport', 'بدجت السعودية', 'Budget Saudi'),
  SA('4110', 'شركة الباحة للاستثمار والتنمية', 'Batic Investments & Logistics', 'sa-transport', 'باتك', 'Batic'),
  SA('4190', 'شركة جرير للتسويق', 'Jarir Marketing Co.', 'sa-retail', 'جرير', 'Jarir'),
  SA('4003', 'شركة الإلكترونيات المتحدة', 'United Electronics Co.', 'sa-retail', 'إكسترا', 'eXtra'),
  SA('4240', 'شركة سينومي ريتيل', 'Cenomi Retail', 'sa-retail', 'سينومي ريتيل', 'Cenomi Retail'),
  SA('4161', 'شركة بن داود القابضة', 'BinDawood Holding Co.', 'sa-staples', 'بن داود', 'BinDawood'),
  SA('4001', 'شركة أسواق عبدالله العثيم', 'Abdullah Al Othaim Markets', 'sa-staples', 'العثيم', 'Al Othaim'),
  SA('4006', 'شركة أسواق المزرعة', 'Farm Superstores', 'sa-staples', 'أسواق المزرعة', 'Farm Superstores'),
  SA('6002', 'شركة هرفي للخدمات الغذائية', 'Herfy Food Services Co.', 'sa-consumerserv', 'هرفي', 'Herfy'),
  SA('6004', 'شركة التموين', 'Saudi Airlines Catering Co.', 'sa-consumerserv', 'التموين', 'Catering'),
  SA('1810', 'مجموعة سيرا القابضة', 'Seera Group Holding', 'sa-consumerserv', 'سيرا', 'Seera'),
  SA('7020', 'شركة اتحاد اتصالات', 'Etihad Etisalat Co.', 'sa-telecom', 'موبايلي', 'Mobily'),
  SA('7030', 'شركة الاتصالات المتنقلة السعودية', 'Mobile Telecommunication Co. Saudi Arabia', 'sa-telecom', 'زين السعودية', 'Zain KSA'),
  SA('7203', 'شركة علم', 'Elm Co.', 'sa-software', 'علم', 'Elm'),
  SA('7202', 'شركة الإنترنت السعودية', 'Arabian Internet & Communications Services', 'sa-software', 'سلوشنز', 'solutions'),
  SA('8010', 'الشركة التعاونية للتأمين', 'Company for Cooperative Insurance', 'sa-insurance', 'التعاونية', 'Tawuniya'),
  SA('8210', 'شركة بوبا العربية للتأمين التعاوني', 'Bupa Arabia for Cooperative Insurance', 'sa-insurance', 'بوبا العربية', 'Bupa Arabia'),
  SA('8012', 'شركة الجزيرة تكافل تعاوني', 'Jazira Takaful Taawuni Co.', 'sa-insurance', 'الجزيرة تكافل', 'Jazira Takaful'),
  SA('1111', 'مجموعة تداول السعودية القابضة', 'Saudi Tadawul Group Holding', 'sa-finserv', 'تداول السعودية', 'Tadawul Group'),
  SA('1182', 'شركة أملاك العالمية للتمويل العقاري', 'Amlak International Finance', 'sa-finserv', 'أملاك', 'Amlak'),
  SA('4321', 'شركة سينومي سنترز', 'Cenomi Centers', 'sa-realestate', 'سينومي سنترز', 'Cenomi Centers'),
  SA('4020', 'الشركة العقارية السعودية', 'Saudi Real Estate Co.', 'sa-realestate', 'العقارية', 'Al Akaria'),
  SA('4300', 'شركة دار الأركان للتطوير العقاري', 'Dar Al Arkan Real Estate Development', 'sa-realestate', 'دار الأركان', 'Dar Al Arkan'),
  SA('4090', 'شركة طيبة للاستثمار', 'Taiba Investments Co.', 'sa-realestate', 'طيبة', 'Taiba'),
  SA('4150', 'شركة الرياض للتعمير', 'Arriyadh Development Co.', 'sa-realestate', 'التعمير', 'Arriyadh Development'),
  SA('4330', 'صندوق الرياض ريت', 'Riyad REIT Fund', 'sa-reits', 'الرياض ريت', 'Riyad REIT'),
  SA('4331', 'صندوق الجزيرة ريت', 'AlJazira Mawten REIT', 'sa-reits', 'الجزيرة ريت', 'AlJazira REIT'),
  SA('4142', 'شركة رياض كيبل', 'Riyadh Cables Group', 'sa-capgoods', 'رياض كيبل', 'Riyadh Cables'),
  SA('1301', 'شركة أسلاك', 'Aslak Co.', 'sa-capgoods', 'أسلاك', 'Aslak'),
  SA('1214', 'شركة الحسن غازي إبراهيم شاكر', 'Al Hassan Ghazi Ibrahim Shaker', 'sa-capgoods', 'شاكر', 'Shaker'),
  SA('2360', 'الشركة السعودية لصناعة الأنابيب الفخارية', 'Saudi Vitrified Clay Pipe Co.', 'sa-capgoods', 'أنابيب السعودية', 'SVCP'),

  /* -------------------------------- US ------------------------------- */
  US('AAPL', 'أبل', 'Apple Inc.', 'us-tech', ['SPX', 'NDX', 'DJI']),
  US('MSFT', 'مايكروسوفت', 'Microsoft Corp.', 'us-tech', ['SPX', 'NDX', 'DJI']),
  US('NVDA', 'إنفيديا', 'NVIDIA Corp.', 'us-tech', ['SPX', 'NDX']),
  US('AMZN', 'أمازون', 'Amazon.com Inc.', 'us-discretionary', ['SPX', 'NDX']),
  US('GOOGL', 'ألفابت', 'Alphabet Inc. Class A', 'us-comm', ['SPX', 'NDX']),
  US('META', 'ميتا بلاتفورمز', 'Meta Platforms Inc.', 'us-comm', ['SPX', 'NDX']),
  US('TSLA', 'تسلا', 'Tesla Inc.', 'us-discretionary', ['SPX', 'NDX']),
  US('BRK.B', 'بيركشاير هاثاواي', 'Berkshire Hathaway Inc. Class B', 'us-financials'),
  US('LLY', 'إيلي ليلي', 'Eli Lilly & Co.', 'us-health'),
  US('AVGO', 'برودكوم', 'Broadcom Inc.', 'us-tech', ['SPX', 'NDX']),
  US('JPM', 'جي بي مورغان تشيس', 'JPMorgan Chase & Co.', 'us-financials', ['SPX', 'DJI']),
  US('V', 'فيزا', 'Visa Inc.', 'us-financials', ['SPX', 'DJI']),
  US('XOM', 'إكسون موبيل', 'Exxon Mobil Corp.', 'us-energy'),
  US('UNH', 'يونايتد هيلث', 'UnitedHealth Group Inc.', 'us-health', ['SPX', 'DJI']),
  US('MA', 'ماستركارد', 'Mastercard Inc.', 'us-financials'),
  US('JNJ', 'جونسون آند جونسون', 'Johnson & Johnson', 'us-health', ['SPX', 'DJI']),
  US('PG', 'بروكتر آند غامبل', 'Procter & Gamble Co.', 'us-staples', ['SPX', 'DJI']),
  US('HD', 'هوم ديبوت', 'Home Depot Inc.', 'us-discretionary', ['SPX', 'DJI']),
  US('COST', 'كوستكو', 'Costco Wholesale Corp.', 'us-staples', ['SPX', 'NDX']),
  US('ORCL', 'أوراكل', 'Oracle Corp.', 'us-tech'),
  US('MRK', 'ميرك', 'Merck & Co. Inc.', 'us-health', ['SPX', 'DJI']),
  US('ABBV', 'آبفي', 'AbbVie Inc.', 'us-health'),
  US('CVX', 'شيفرون', 'Chevron Corp.', 'us-energy', ['SPX', 'DJI']),
  US('AMD', 'إيه إم دي', 'Advanced Micro Devices Inc.', 'us-tech', ['SPX', 'NDX']),
  US('ADBE', 'أدوبي', 'Adobe Inc.', 'us-tech', ['SPX', 'NDX']),
  US('CRM', 'سيلزفورس', 'Salesforce Inc.', 'us-tech', ['SPX', 'DJI']),
  US('KO', 'كوكا كولا', 'Coca-Cola Co.', 'us-staples', ['SPX', 'DJI']),
  US('PEP', 'بيبسيكو', 'PepsiCo Inc.', 'us-staples', ['SPX', 'NDX']),
  US('WMT', 'وول مارت', 'Walmart Inc.', 'us-staples', ['SPX', 'DJI']),
  US('BAC', 'بنك أوف أمريكا', 'Bank of America Corp.', 'us-financials'),
  US('NFLX', 'نتفليكس', 'Netflix Inc.', 'us-comm', ['SPX', 'NDX']),
  US('TMO', 'ثيرمو فيشر', 'Thermo Fisher Scientific Inc.', 'us-health'),
  US('MCD', 'ماكدونالدز', 'McDonald’s Corp.', 'us-discretionary', ['SPX', 'DJI']),
  US('CSCO', 'سيسكو', 'Cisco Systems Inc.', 'us-tech', ['SPX', 'NDX', 'DJI']),
  US('ACN', 'أكسنتشر', 'Accenture plc', 'us-tech'),
  US('LIN', 'ليندي', 'Linde plc', 'us-materials'),
  US('INTC', 'إنتل', 'Intel Corp.', 'us-tech', ['SPX', 'NDX']),
  US('QCOM', 'كوالكوم', 'QUALCOMM Inc.', 'us-tech', ['SPX', 'NDX']),
  US('TXN', 'تكساس إنسترومنتس', 'Texas Instruments Inc.', 'us-tech', ['SPX', 'NDX']),
  US('DIS', 'ديزني', 'Walt Disney Co.', 'us-comm', ['SPX', 'DJI']),
  US('VZ', 'فيرايزون', 'Verizon Communications Inc.', 'us-comm', ['SPX', 'DJI']),
  US('PFE', 'فايزر', 'Pfizer Inc.', 'us-health'),
  US('NKE', 'نايكي', 'Nike Inc.', 'us-discretionary', ['SPX', 'DJI']),
  US('BA', 'بوينغ', 'Boeing Co.', 'us-industrials', ['SPX', 'DJI']),
  US('GS', 'غولدمان ساكس', 'Goldman Sachs Group Inc.', 'us-financials', ['SPX', 'DJI']),
  US('CAT', 'كاتربيلر', 'Caterpillar Inc.', 'us-industrials', ['SPX', 'DJI']),
  US('HON', 'هانيويل', 'Honeywell International Inc.', 'us-industrials', ['SPX', 'NDX']),
  US('NEE', 'نيكست إيرا للطاقة', 'NextEra Energy Inc.', 'us-utilities'),
  US('AMT', 'أمريكان تاور', 'American Tower Corp.', 'us-realestate'),
  US('UNP', 'يونيون باسيفيك', 'Union Pacific Corp.', 'us-industrials'),
];

export const DEMO_INDICES: Array<{
  id: string;
  market: MarketId;
  ar: string;
  en: string;
}> = [
  { id: 'TASI', market: 'SA', ar: 'المؤشر العام (تاسي)', en: 'Tadawul All Share Index' },
  { id: 'SPX', market: 'US', ar: 'ستاندرد آند بورز ٥٠٠', en: 'S&P 500' },
  { id: 'NDX', market: 'US', ar: 'ناسداك ١٠٠', en: 'Nasdaq 100' },
  { id: 'DJI', market: 'US', ar: 'داو جونز الصناعي', en: 'Dow Jones Industrial Average' },
];
