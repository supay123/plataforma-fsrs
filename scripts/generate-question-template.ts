import * as XLSX from "xlsx";

const worksheet = XLSX.utils.aoa_to_sheet([
  [
    "pregunta",
    "respuesta_a",
    "respuesta_b",
    "respuesta_c",
    "respuesta_d",
    "respuesta_correcta",
    "explicacion",
  ],
  [
    "¿Cuánto es $2+2$?",
    "3",
    "4",
    "5",
    "6",
    "B",
    "$2+2=4$ (opcional)",
  ],
]);
worksheet["!cols"] = [
  { wch: 36 },
  { wch: 24 },
  { wch: 24 },
  { wch: 24 },
  { wch: 24 },
  { wch: 20 },
  { wch: 40 },
];
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Preguntas");
XLSX.writeFile(workbook, "frontend/public/templates/plantilla-preguntas.xlsx");
