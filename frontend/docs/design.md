# Мобильные экраны ФинСмарт

Источник: [Figma, раздел регистрации](https://www.figma.com/design/x8MvvpTA5kYbVzB8GTvnTf/ФинСмарт?node-id=475-2694).

Реализована последовательность 01 Welcome, 02 Регистрация, 03 Ввод данных,
04 Успешная регистрация, 05 Первичная настройка и 06 Dashboard.
Ориентир — мобильные фреймы шириной 320px: светлый фон, сине-фиолетовый
акцент, компактные поля, индикатор этапов, кольцевая аналитика,
рейтинг здоровья, бюджет и копилка. Desktop адаптирован с Sidebar.

Финансовые блоки показывают пустые состояния до ввода личных данных:
без сумм, готовых категорий расходов, рассчитанного рейтинга и созданных целей.

## Точность переноса

Figma-подключение не предоставило данные слоёв и оригинальные ассеты:
оно сообщает об отсутствии edit access. Пользователь разрешил вёрстку
по видимому макету в браузере с небольшими отличиями. Поэтому точные
числовые токены и экспорт исходных изображений не заявляются.

Иконки интерфейса — Lucide, текстовый логотип собран обычным текстом.
На сенсорных устройствах текст в полях увеличен до 16px. Кнопки немного
выше исходных фреймов, чтобы их было удобно нажимать пальцем.

Три иллюстрации созданы встроенным imagegen как визуально близкие замены,
это не экспорт оригиналов Figma. Они имеют прозрачный фон, сохранены
в репозитории и показываются с object-fit: contain. Скриншоты макета
не используются как готовый интерфейс или фон.

| Файл | Место | Исходный размер |
| --- | --- | --- |
| `public/illustrations/wallet.png` | Welcome, между описанием и действиями | 1448 × 1086 |
| `public/illustrations/success.png` | Успех, над заголовком | 1470 × 1070 |
| `public/illustrations/statement.png` | Настройка, над предложением импорта | 1470 × 1070 |

## Описания для генерации иллюстраций

Режим: встроенный image_gen, transparent_background=true. Изображения
созданы по описанию, без редактирования изображений пользователя.

Wallet: small 3D illustration for a personal finance app welcome screen.
Compact violet-blue wallet with rounded snap closure, lavender payment card
behind it, floating gold coins, pale translucent lavender orbital swoosh,
tiny white rounded square with upward blue chart arrow. Soft polished
friendly 3D clay/plastic, indigo #342fd0 and lavender, transparent background,
landscape around 4:3, no interface, written text, logos or watermark.

Success: small 3D illustration for registration success. Glossy violet-blue
circular disk with white checkmark, folded violet paper airplane at lower
right, lavender and mint confetti dashes, translucent orbital swoosh.
Friendly polished 3D clay/plastic, pastel lighting, indigo #342fd0,
transparent background, landscape around 4:3, no text or watermark.

Statement: small 3D illustration for finance onboarding. Tilted floating
stack of white-lavender bank statement sheets, indigo bank building symbol,
lavender bullet lines, glossy violet chips labelled CSV and XLSX.
Tiny geometric confetti, friendly polished 3D clay/plastic, indigo #342fd0
and lavender, transparent background, landscape around 4:3, no interface
or other text, logos or watermark.
