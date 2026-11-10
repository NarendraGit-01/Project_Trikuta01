# Temple Staff User Guide: Trikuta Temple Receipt Management System

Welcome to the **Sri Trikoteswara Swamy Temple Receipt Management System**. This guide provides staff members with step-by-step instructions for operating the system on tablets, mobile phones, or desktop computers.

---

## 1. Accessing the System

- **Application URL**: `http://<server-ip>:5173` (or `http://localhost:5173` when using locally).
- **Default Accounts**:
  - Staff: `staff` / `staff123`
  - Admin: `admin` / `admin123`

---

## 2. Receipt Photography Best Practices

For highest OCR accuracy and fast processing:
1. **Lighting**: Ensure even, bright lighting across the entire receipt. Avoid harsh shadows cast by hands or mobile devices.
2. **Angle**: Hold the phone directly parallel to the receipt (top-down view) rather than at a sharp angle.
3. **Framing**: Keep all four corners of the receipt within the frame. Leave a small border around the paper.
4. **Orientation**: If a photo is taken upside down, the system will automatically detect and rotate it, but keeping it upright ensures fastest processing.

---

## 3. Scanning & Processing a Receipt

1. Click the **Scan & OCR (రసీదు స్కాన్)** tab in the top navigation bar.
2. **Choose an image source**:
   - **Camera / File Upload**: Click the dashed upload area to take a photo or select an existing image file.
   - **Reference Gallery**: To test pre-loaded temple receipts, click any card in the reference gallery.
3. **Configure Options**:
   - **Active Model**: Defaults to `gemini-3.5-flash-lite` (fast and cost-effective).
   - **Fast Mode**: Check this box if you want to skip the line-by-line transcription pass to reduce wait time by ~3 seconds.
4. Click **"RUN OCR EXTRACTION & VERIFY"**.
5. The live progress bar will show the stages of processing. Once finished, the screen transitions automatically to the **Split-Screen Verification Page**.

---

## 4. Split-Screen Verification & Correction

The verification screen presents the original receipt photo on the left and the editable verification form on the right.

### Left Panel: Document Viewer
- **Rotate**: Click the Rotate button ($\circlearrowright$) to turn the image in 90° increments if needed.
- **Zoom**: Use Zoom In ($+$) and Zoom Out ($-$) to inspect fine handwriting strokes.
- **Reset**: Resets zoom and rotation back to default.

### Right Panel: Editable Form
1. **Receipt Header & Dates**:
   - Verify the Receipt Number, Book Year, and Receipt Date.
   - Verify the Abhishekam From and To dates.
2. **Gothram Resolution (గోత్రం)**:
   - The system checks the handwritten Gothram against the temple's **2,099 Master Gothrams**.
   - If verified, a green badge displays *"✓ Verified in Master List"*.
   - To change or search, start typing in the Gothram search bar (type 2+ letters) to view matching suggestions with similarity rankings.
3. **Family Surname (ఇంటిపేరు)**:
   - Enter the family surname once in the dedicated **Family Surname** card.
   - Surnames typed in English automatically populate the Telugu field and apply to all family members.
4. **Devotee Family Members (కుటుంబ సభ్యులు)**:
   - Devotees listed on the receipt appear as individual items.
   - Each devotee item displays their **Given Name** in English and Telugu.
   - To add additional family members, click **"+ Add Member"**.
   - To remove an entry, click the trash icon.
5. **Contact Phone Numbers (ఫోన్ నంబర్లు)**:
   - Validates that phone numbers are 10 digits long.
   - Green indicator displays *"✓ Valid Mobile"*.
   - Mark the primary contact phone with the radio button.
6. **Postal Address for Prasadam (చిరునామా)**:
   - If an address is written in Telugu, it routes directly into the Telugu address box, and the English transliteration auto-fills.
   - Ensure the 6-digit postal PIN code is recorded for courier dispatch.

---

## 5. Saving Records

- **"Confirm & Finalize Record"**:
  - Enforces mandatory checks: receipt number, Gothram, at least one devotee name, at least one valid 10-digit mobile number, and address.
  - Confirmed records immediately become available on the **Pooja Sankalpam Sheet** and the **Prasadam Dispatch Queue**.
- **"Save as Incomplete"**:
  - Use this if a phone number or address is illegible and requires follow-up with the devotee or priest.
  - Saves the record under status `INCOMPLETE` without blocking your workflow.

---

## 6. Daily Pooja Sankalpam Namavali (పూజా సంకల్పం)

1. Click the **Sankalpam (పూజా సంకల్పం)** tab.
2. All confirmed devotees are automatically grouped by **Gothram** in traditional temple namavali format:
   `గోత్రము: ... | నామధేయులు: ...`.
3. High-contrast, large Telugu fonts ensure easy reading during religious ceremonies.
4. Click **"Print Sankalpam Sheet"** to generate clean, printable chanting sheets for the head priest.

---

## 7. Prasadam Postal Dispatch (ప్రసాదం పంపిణీ)

1. Click the **Dispatch (ప్రసాదం పంపిణీ)** tab.
2. The dispatch queue lists all confirmed pooja receipts with complete mailing addresses.
3. Select specific records or click **"Select All"**.
4. Click **"Print Postal Labels"** to generate shipping slips formatted for envelope printing or mailing sticker sheets.

---

## 8. Exporting Data to Excel / CSV

- To export the full receipt database for accounting or district records:
  - Open `http://<server-ip>:8000/api/v1/receipts/export/csv` in your browser.
  - Downloads a UTF-8 encoded CSV file compatible with Microsoft Excel, preserving Telugu script without corruption.
- To export the Sankalpam chanting list to CSV:
  - Open `http://<server-ip>:8000/api/v1/receipts/export/sankalpam-csv`.
