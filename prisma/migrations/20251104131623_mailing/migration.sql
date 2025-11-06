-- CreateTable
CREATE TABLE "Mail" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "classId" INTEGER NOT NULL,
    "subjects" TEXT[],
    "groups" JSONB NOT NULL,

    CONSTRAINT "Mail_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Mail" ADD CONSTRAINT "Mail_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
