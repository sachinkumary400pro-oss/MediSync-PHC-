import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from app.models.transfer import TransferRequest


def generate_transfer_slip_pdf(transfer: TransferRequest) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        alignment=1,
        textColor=colors.HexColor("#064e3b")
    )
    subtitle_style = ParagraphStyle(
        "SubTitleStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        alignment=1,
        textColor=colors.HexColor("#334155")
    )
    body_style = ParagraphStyle(
        "BodyStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#1e293b")
    )
    bold_style = ParagraphStyle(
        "BoldStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#0f172a")
    )

    elements = []

    # 1. Header
    elements.append(Paragraph("GOVERNMENT OF TAMIL NADU", subtitle_style))
    elements.append(Paragraph("DEPARTMENT OF PUBLIC HEALTH & PREVENTIVE MEDICINE", subtitle_style))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("OFFICIAL INTER-PHC MEDICINE TRANSFER SLIP", title_style))
    elements.append(Paragraph("MediSync PHC Redistribution Network • Chengalpattu District", subtitle_style))
    elements.append(Spacer(1, 14))

    # 2. Metadata Grid
    created_date = transfer.created_at.strftime("%d-%m-%Y %H:%M") if transfer.created_at else datetime.utcnow().strftime("%d-%m-%Y")
    cold_chain_text = "VERIFIED (2°C - 8°C with Ice Gel Packs)" if transfer.cold_chain_confirmed else "Standard Ambient Transit"

    meta_data = [
        [
            Paragraph(f"<b>Transfer Voucher:</b> {transfer.request_number}", body_style),
            Paragraph(f"<b>Status:</b> {transfer.status.upper()}", bold_style)
        ],
        [
            Paragraph(f"<b>Date Issued:</b> {created_date}", body_style),
            Paragraph(f"<b>Urgency:</b> {transfer.urgency.upper()}", bold_style)
        ],
        [
            Paragraph(f"<b>Transit Distance:</b> {transfer.distance_km} km", body_style),
            Paragraph(f"<b>Cold Chain:</b> {cold_chain_text}", bold_style)
        ]
    ]

    meta_table = Table(meta_data, colWidths=[270, 270])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 12))

    # 3. Source and Destination Centre Info
    source_name = transfer.from_phc.name if transfer.from_phc else transfer.from_phc_id
    source_phone = transfer.from_phc.phone if transfer.from_phc else "N/A"
    dest_name = transfer.to_phc.name if transfer.to_phc else transfer.to_phc_id
    dest_phone = transfer.to_phc.phone if transfer.to_phc else "N/A"

    route_data = [
        [
            Paragraph("<b>DISPATCHING DONOR PHC:</b>", bold_style),
            Paragraph("<b>RECEIVING RECIPIENT PHC:</b>", bold_style)
        ],
        [
            Paragraph(f"<b>{source_name}</b><br/>Phone: {source_phone}<br/>Block: {transfer.from_phc.block if transfer.from_phc else ''}", body_style),
            Paragraph(f"<b>{dest_name}</b><br/>Phone: {dest_phone}<br/>Block: {transfer.to_phc.block if transfer.to_phc else ''}", body_style)
        ]
    ]
    route_table = Table(route_data, colWidths=[270, 270])
    route_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#94a3b8")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(route_table)
    elements.append(Spacer(1, 14))

    # 4. Transferred Items Table
    items_header = [
        Paragraph("<b>#</b>", bold_style),
        Paragraph("<b>Medicine Description</b>", bold_style),
        Paragraph("<b>Category / Unit</b>", bold_style),
        Paragraph("<b>Batch No</b>", bold_style),
        Paragraph("<b>Approved Qty</b>", bold_style),
    ]

    items_rows = [items_header]
    for idx, itm in enumerate(transfer.items):
        med_name = itm.medicine.name if itm.medicine else itm.medicine_id
        med_unit = itm.medicine.unit if itm.medicine else "units"
        qty = itm.approved_qty or itm.requested_qty
        items_rows.append([
            Paragraph(str(idx + 1), body_style),
            Paragraph(f"<b>{med_name}</b>", body_style),
            Paragraph(med_unit, body_style),
            Paragraph(itm.batch_no or "Standard Batch", body_style),
            Paragraph(f"<b>{qty}</b>", bold_style),
        ])

    items_table = Table(items_rows, colWidths=[30, 240, 90, 100, 80])
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#047857")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 25))

    # 5. Clinical Justification Note
    if transfer.reason:
        elements.append(Paragraph(f"<b>Clinical Justification:</b> {transfer.reason}", body_style))
        elements.append(Spacer(1, 20))

    # 6. Official Signatures Section
    sig_data = [
        [
            Paragraph("<b>DISPATCHED BY:</b><br/><br/><br/>_______________________<br/>Pharmacist Signature & Stamp", body_style),
            Paragraph("<b>TRANSIT CARRIER / 108:</b><br/><br/><br/>_______________________<br/>Driver / Escort Signature", body_style),
            Paragraph("<b>RECEIVED & VERIFIED:</b><br/><br/><br/>_______________________<br/>Medical Officer / Pharmacist", body_style),
        ]
    ]
    sig_table = Table(sig_data, colWidths=[180, 180, 180])
    sig_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.append(sig_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
