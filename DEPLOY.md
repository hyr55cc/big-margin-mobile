# نشر BIG MARGIN — Deploying BIG MARGIN

هذا المستند يغطي شيئين: رفع المستودع إلى GitHub، ثم نشر التطبيق.

This covers two things: pushing the repository to GitHub, then deploying the app.

---

## ١. الرفع إلى GitHub — Push to GitHub

المستودع مُهيّأ بالفعل بتاريخ commits كامل. الرابط الصحيح مضبوط على:
`https://github.com/hyr55cc/big-margin-mobile.git`

```bash
git remote -v            # يجب أن يشير origin إلى مستودعك
git push -u origin main
```

إذا كان المستودع على GitHub يحتوي بالفعل على commit (مثل README أُنشئ تلقائيًا عند
إنشاء المستودع)، فاختر واحدًا:

```bash
# إمّا: ادفع فوقه — يمسح المحتوى الأولي على GitHub
git push -u origin main --force

# أو: ادمجه أولًا ثم ادفع — يحافظ على الاثنين
git pull --rebase origin main
git push -u origin main
```

> **ملاحظة:** لا يمكن الدفع من داخل جلسة Claude لأن الوسيط لا يمنح صلاحية إلا
> للمستودعات المضافة إلى مصادر الجلسة. الدفع من جهازك يعمل مباشرة.

---

## ٢. النشر — Deploying

```bash
npm ci
npm run build        # ينتج مجلد dist/
```

الناتج ملفات ثابتة فقط: أي استضافة تخدم ملفات ثابتة تكفي. لا يوجد خادم مطلوب
للواجهة نفسها.

### الشرط الوحيد الذي لا يمكن تجاهله: إعادة التوجيه إلى index.html

BIG MARGIN يوجّه المسارات في المتصفح. بدون إعادة توجيه، فتح `/app/options` مباشرة
أو تحديث الصفحة أو مشاركة رابط عميق يعطي **404**. هذا أكثر خطأ يظهر عند أول نشر.

The single non-negotiable requirement: **every path must serve `index.html`.**
Without it, opening `/app/options` directly, refreshing, or sharing a deep link
returns a 404. This is the most common first-deploy bug.

| المنصة | ما يلزم | الحالة |
| --- | --- | --- |
| Netlify / Cloudflare Pages | `public/_redirects` | ✅ مضاف في المستودع |
| Vercel | `vercel.json` | ✅ مضاف في المستودع |
| GitHub Pages | نسخة `404.html` من `index.html` | انظر أدناه |
| Nginx / Apache | إعداد يدوي | انظر أدناه |

**Netlify / Cloudflare Pages** — لا شيء إضافي:

```
Build command:      npm run build
Publish directory:  dist
```

**Vercel** — لا شيء إضافي؛ يقرأ `vercel.json` تلقائيًا.

**GitHub Pages** — يحتاج نسخة من `index.html` باسم `404.html`:

```bash
npm run build && cp dist/index.html dist/404.html
```

**Nginx**:

```nginx
root /var/www/big-margin/dist;

location / {
  try_files $uri $uri/ /index.html;
}

# الأصول تحمل بصمة في اسمها، فيمكن تخزينها للأبد
location /assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}

# index.html لا يُخزَّن أبدًا، وإلا بقي المستخدمون على نسخة قديمة
location = /index.html {
  add_header Cache-Control "no-cache";
}
```

**Apache** — ضع `.htaccess` في `dist/`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### التخزين المؤقت — Caching

القاعدة في سطرين: **الأصول أبدية، و`index.html` لا يُخزَّن إطلاقًا.** ملفات
`dist/assets/` تحمل بصمة محتوى في أسمائها، فتخزينها سنة كاملة آمن. أما `index.html`
فهو الذي يشير إلى أحدث بصمة — تخزينه يعني أن المستخدمين يبقون على نسخة قديمة بعد كل
إصدار. نفس القاعدة تنطبق على `manifest.webmanifest`.

---

## ٣. البيانات — Data

الواجهة **لا تتصل بأي مزوّد بيانات مباشرة ولا تحمل أي مفتاح**. راجع `.env.example`:
كل متغير يبدأ بـ `VITE_` يُدمج في ملفات JavaScript العلنية.

```bash
cp .env.example .env
```

**النشر التجريبي (الحالي):** اتركه كما هو.

```ini
VITE_DATA_PROVIDER=demo
VITE_OPTIONS_PROVIDER=demo
```

كل رقم في التطبيق مولَّد، ويظهر شريط دائم أعلى الشاشة يوضّح ذلك. هذا وضع صالح للعرض
والتجربة، وغير صالح لاتخاذ قرارات.

**النشر الحقيقي:** يحتاج خدمة خلفية تطبيع بيانات المزوّدين إلى الأشكال الموجودة في
`src/types`، وتحمل المفاتيح. الواجهة عندها:

```ini
VITE_DATA_PROVIDER=http
VITE_API_BASE_URL=https://api.your-domain.com/api/v1
VITE_OPTIONS_PROVIDER=http     # أو off إذا لم تُرخّص سلاسل الخيارات بعد
```

`src/data/live/HttpProvider.ts` يوثّق كل نقطة نهاية متوقّعة، و`README.md` يشرح عقد
البيانات: **لا قيمة تُخترع أبدًا**، وكل سجلّ يحمل `provenance` بمصدره ووقته وحالته.

> إذا لم تكن قد رخّصت سلاسل خيارات بعد، اضبط `VITE_OPTIONS_PROVIDER=off`. القسم كله
> يختفي — لا يظهر في القائمة ولا كتبويب. عرض سلسلة فارغة يُقرأ كسوق هادئة، لا كبيانات
> غائبة، وهذا بالضبط ما تمنعه قاعدة "لا بيانات وهمية".

---

## ٤. قبل الإطلاق — Pre-launch checklist

- [ ] `npm run build` ينجح، و`npm test` يمرّ (١٠٦ اختبارًا)
- [ ] فتح رابط عميق مباشرة بعد النشر: `/app/options` و `/app/stock/AAPL` — لا 404
- [ ] تحديث الصفحة على مسار داخلي — لا 404
- [ ] التبديل بين العربية والإنجليزية، والتأكد من اتجاه الأرقام والتواريخ
- [ ] تجربة "إضافة إلى الشاشة الرئيسية" على iPhone وAndroid — الأيقونة تظهر صحيحة
- [ ] التأكد من أن شريط "بيانات تجريبية" ظاهر إن كان النشر تجريبيًا
- [ ] التأكد من ظهور الإخلاءات الثلاثة (الاستثمار، الشرعي، البيانات)
- [ ] إن رُبطت بيانات حقيقية: التأكد من أن مدة التأخير المعروضة هي المدة التعاقدية
      الفعلية، لا رقم افتراضي
