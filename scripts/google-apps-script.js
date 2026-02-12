/**
 * Google Apps Script - Deploy as Web App
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://script.google.com and create a new project
 * 2. Paste this entire code into the editor
 * 3. Click Deploy > New deployment
 * 4. Select type: "Web app"
 * 5. Set "Execute as": "Me"
 * 6. Set "Who has access": "Anyone"
 * 7. Click Deploy and copy the URL
 * 8. Create a file .env.local in the project root with:
 *    GOOGLE_SHEETS_WEBHOOK_URL=<paste-the-url-here>
 * 
 * Target Sheet: https://docs.google.com/spreadsheets/d/16CpyXu4WOanlXOX24kYvfmN_zEpCy2Ylcb7yYFImT44
 * Sheet name: Hoja 1
 * Columns: Usuario | Correo | Contraseña Provisoria
 */

const SPREADSHEET_ID = "16CpyXu4WOanlXOX24kYvfmN_zEpCy2Ylcb7yYFImT44";
const SHEET_NAME = "Hoja 1";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: "Hoja no encontrada" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Append row: Usuario | Correo | Contraseña Provisoria
    sheet.appendRow([
      data.usuario || "",
      data.correo || "",
      data.contrasena || "",
    ]);

    return ContentService.createTextOutput(
      JSON.stringify({ success: true, message: "Fila agregada correctamente" })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function (run manually in Apps Script editor)
function testDoPost() {
  const e = {
    postData: {
      contents: JSON.stringify({
        usuario: "Test User",
        correo: "test@naitus.cl",
        contrasena: "ABC1234!",
      }),
    },
  };
  const result = doPost(e);
  Logger.log(result.getContent());
}
