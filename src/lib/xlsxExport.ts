import ExcelJS from "exceljs";
import type { Booking } from "@prisma/client";

export async function buildBookingsWorkbook(
  bookings: Booking[]
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Restaurang Rissel — bokningssystem";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Bokningar");

  sheet.columns = [
    { header: "Datum", key: "date", width: 14 },
    { header: "Tid", key: "timeSlot", width: 8 },
    { header: "Namn", key: "name", width: 24 },
    { header: "Antal personer", key: "partySize", width: 14 },
    { header: "Bordstyp", key: "tableTypeId", width: 12 },
    { header: "Telefon", key: "phone", width: 16 },
    { header: "Mail", key: "email", width: 28 },
    { header: "Allergier / önskemål", key: "allergies", width: 32 },
    { header: "Status", key: "status", width: 12 },
    { header: "Bokad", key: "createdAt", width: 20 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE1DBC6" },
  };

  for (const b of bookings) {
    sheet.addRow({
      date: b.date,
      timeSlot: b.timeSlot,
      name: b.name,
      partySize: b.partySize,
      tableTypeId: b.tableTypeId,
      phone: b.phone,
      email: b.email,
      allergies: b.allergies,
      status: b.status,
      createdAt: b.createdAt.toISOString().slice(0, 16).replace("T", " "),
    });
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  return workbook.xlsx.writeBuffer();
}
