# Zaganjanje aplikacije
## Predpogoji
`Node.js >= 22.x`

`pnpm >= 10.x`

`mysql >= 8.x`

## Podatkovna baza
API potrebuje MySQL podatkovno bazo. Ko se bazo vzpostavi je potrebno dobiti URL do baze.

Struktura URL je sledeča: `mysql://[user]:[password]@ip/[schema]`

Shema je vseeno kako se imenuje, ampak jo je treba dodati.

Ta URL se nastavi v `.env` datoteko. `.example.env` ima nastavljene vse parametre, ki jih aplikacija potrebuje.

## Nastavitev elektronske pošte
Za nastavitev elektronske pošte so potrebni naslednji podatki: 

- domena SMTP strežnika (npr. smtp.domena.si)
- Vrata SMTP strežnika
- Mail uporabnik (npr. noreply@domena.si)
- Geslo mail uporabnika

Vse to se ponovno nastavi v `.env` datoteko. V tem vrstnem redu so to vrednosti `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`.

## Izpolnjevanje ostalih .env lastnosti
- PORT = vrata na katerih aplikacija posluša za zahteve
- ALLOWED_DOMAIN = Domena na kateri bo dostopno obličje urnika
- API_DOMAIN = Domena na kateri deluje aplikacija
- NODE_ENV = Tip zagona aplikacije (development ali production)

## Koraki zagona aplikacije
Najprej naložimo vse pakete potrebne za zagon aplikacije s `pnpm i`.

> [!NOTE]
> Pred prvim zagonom ali po spremembi strukture podatkovne baze v
> `prisma/schema.prisma` je potrebno zagnati `npx prisma migrate
> deploy`, da sprožimo ustvarjanje strukture podatkovne baze.

> [!WARNING]
> Potrebno je, da so vse lastnosti v `.env` zapolnjene pred izgradnjo
> in zagonom aplikacije.

Aplikacijo se najprej zgradi s `pnpm build` in nato zažene s `pnpm start`.

# Prispevki
Nejc Živic: Izdelava aplikacije

Miha Šafranko: Izdelava skripte za razčlenitev urnika in ICS implementacija
