-- CreateTable
CREATE TABLE "ProfTime" (
    "profId" INTEGER NOT NULL,
    "timetableId" INTEGER NOT NULL,

    CONSTRAINT "ProfTime_pkey" PRIMARY KEY ("profId","timetableId")
);

-- CreateTable
CREATE TABLE "Profmail" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "profId" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "Profmail_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProfTime" ADD CONSTRAINT "ProfTime_profId_fkey" FOREIGN KEY ("profId") REFERENCES "Professor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfTime" ADD CONSTRAINT "ProfTime_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "Timetable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profmail" ADD CONSTRAINT "Profmail_profId_fkey" FOREIGN KEY ("profId") REFERENCES "Professor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
