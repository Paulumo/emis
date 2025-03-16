import xml.etree.ElementTree as ET
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm, cm

# Register a Chinese font (you'll need to have this font file or substitute with another)
try:
    pdfmetrics.registerFont(TTFont('SimSun', 'simsun.ttc'))
except:
    print("Warning: SimSun font not found. Chinese characters may not display correctly.")
    # Fall back to a default font that comes with ReportLab
    font_name = 'Helvetica'
else:
    font_name = 'SimSun'

def parse_di_file(file_path):
    """Parse the .di XML file and extract content"""
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        # Extract basic information
        document_info = {
            'agency': get_text(root, './發文機關/全銜'),
            'address': get_text(root, './地址'),
            'contact': [get_text(root, './聯絡方式') for el in root.findall('./聯絡方式')],
            'recipient': get_text(root, './受文者/交換表'),
            'date': get_text(root, './發文日期/年月日'),
            'reference_number': f"{get_text(root, './發文字號/字')}字第{get_text(root, './發文字號/文號/年度')}{get_text(root, './發文字號/文號/流水號')}號",
            'speed': get_text(root, './速別'),
            'security': get_text(root, './密等及解密條件或保密期限/密等'),
            'attachments': get_text(root, './附件/文字'),
            'subject': get_text(root, './主旨/文字'),
            'explanation': []
        }
        
        # Extract explanation sections
        for paragraph in root.findall('./段落[@段名="說明："]/條列'):
            number = paragraph.get('序號', '')
            text = get_text(paragraph, './文字')
            document_info['explanation'].append((number, text))
        
        # Extract recipient information
        document_info['original_recipient'] = get_text(root, './正本/全銜')
        document_info['copy_recipient'] = get_text(root, './副本')
        
        return document_info
    except Exception as e:
        print(f"Error parsing .di file: {e}")
        return None

def parse_sw_file(file_path):
    """Parse the .sw XML file and extract content"""
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        # Extract basic information
        exchange_info = {
            'full_name': get_text(root, './全銜'),
            'agency_code': get_text(root, './機關代碼'),
            'attachments_included': get_text(root, './含附件'),
            'type': get_text(root, './本別/收發處理本別')
        }
        
        return exchange_info
    except Exception as e:
        print(f"Error parsing .sw file: {e}")
        return None

def get_text(element, xpath, default=''):
    """Helper function to safely extract text from an XML element"""
    try:
        found = element.find(xpath)
        if found is not None and found.text is not None:
            return found.text
        return default
    except:
        return default

def create_pdf(di_data, sw_data, output_path):
    """Create a PDF file with the extracted data"""
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2*cm,
        rightMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )
    
    styles = getSampleStyleSheet()
    
    # Create custom styles for Chinese text
    styles.add(ParagraphStyle(
        name='ChineseTitle',
        fontName=font_name,
        fontSize=16,
        alignment=1,  # center
        spaceAfter=10
    ))
    
    styles.add(ParagraphStyle(
        name='ChineseNormal',
        fontName=font_name,
        fontSize=12,
        leading=18,
        spaceAfter=6
    ))
    
    styles.add(ParagraphStyle(
        name='ChineseIndent',
        fontName=font_name,
        fontSize=12,
        leading=18,
        leftIndent=20,
        spaceAfter=6
    ))
    
    # Create content for the PDF
    elements = []
    
    # Document file number and retention period
    elements.append(Paragraph("檔 號：", styles['ChineseNormal']))
    elements.append(Paragraph("保存年限：", styles['ChineseNormal']))
    elements.append(Spacer(1, 5*mm))
    
    # Agency header
    elements.append(Paragraph(f"{di_data['agency']} 函", styles['ChineseTitle']))
    elements.append(Spacer(1, 5*mm))
    
    # Document information table
    data = [
        ["發文日期：", di_data['date']],
        ["發文字號：", di_data['reference_number']],
        ["速別：", di_data.get('speed', '普通件')],
        ["密等及解密條件或保密期限：", di_data.get('security', '')],
        ["附件：", di_data.get('attachments', '如文')]
    ]
    
    info_table = Table(data, colWidths=[100, 300])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), font_name),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 5*mm))
    
    # Subject
    elements.append(Paragraph("主旨：" + di_data['subject'], styles['ChineseNormal']))
    elements.append(Spacer(1, 5*mm))
    
    # Explanation
    elements.append(Paragraph("說明：", styles['ChineseNormal']))
    for number, text in di_data['explanation']:
        elements.append(Paragraph(f"{number}{text}", styles['ChineseIndent']))
    
    # Recipients
    elements.append(Spacer(1, 5*mm))
    elements.append(Paragraph("正本：" + di_data['original_recipient'], styles['ChineseNormal']))
    elements.append(Paragraph("副本：" + (di_data['copy_recipient'] if di_data['copy_recipient'] else " "), styles['ChineseNormal']))
    
    # Recipient information section
    elements.append(Spacer(1, 10*mm))
    elements.append(Paragraph("受文者：" + di_data.get('recipient', '交通部民用航空局'), styles['ChineseNormal']))
    elements.append(Paragraph("地址：" + di_data.get('address', ''), styles['ChineseNormal']))
    
    # Contact information
    for contact in di_data.get('contact', []):
        if contact:
            elements.append(Paragraph(contact, styles['ChineseNormal']))
    
    # Build the PDF
    doc.build(elements)
    
    return True

def convert_files(di_file, sw_file, output_pdf):
    """Main function to convert the XML files to PDF"""
    # Parse the input files
    di_data = parse_di_file(di_file)
    sw_data = parse_sw_file(sw_file)
    
    if not di_data:
        print(f"Failed to parse {di_file}")
        return False
    
    # Create the PDF
    return create_pdf(di_data, sw_data, output_pdf)

def main():
    import argparse
    import tkinter as tk
    from tkinter import filedialog
    
    parser = argparse.ArgumentParser(description='Convert .di and .sw XML files to PDF format')
    parser.add_argument('di_file', nargs='?', help='Path to the .di XML file')
    parser.add_argument('sw_file', nargs='?', help='Path to the .sw XML file')
    parser.add_argument('--output', '-o', help='Output PDF file path')
    
    args = parser.parse_args()
    
    # If command-line arguments weren't provided, open file dialogs
    if not args.di_file or not args.sw_file:
        # Initialize tkinter
        root = tk.Tk()
        root.withdraw()  # Hide the main window
        
        # Ask user to select .di file
        di_file = filedialog.askopenfilename(
            title="Select .di XML file",
            filetypes=[("DI files", "*.di"), ("XML files", "*.xml"), ("All files", "*.*")]
        )
        if not di_file:
            print("No .di file selected. Exiting.")
            return
        
        # Ask user to select .sw file
        sw_file = filedialog.askopenfilename(
            title="Select .sw XML file",
            filetypes=[("SW files", "*.sw"), ("XML files", "*.xml"), ("All files", "*.*")]
        )
        if not sw_file:
            print("No .sw file selected. Exiting.")
            return
    else:
        di_file = args.di_file
        sw_file = args.sw_file
    
    # Check if the input files exist
    if not os.path.exists(di_file):
        print(f"Error: {di_file} does not exist")
        return
    
    if not os.path.exists(sw_file):
        print(f"Error: {sw_file} does not exist")
        return
    
    # Set output path to be in the same folder as the .di file if not specified
    if args.output:
        output_pdf = args.output
    else:
        # Extract base name of the di_file without extension and add .pdf
        di_basename = os.path.splitext(os.path.basename(di_file))[0]
        # Get the directory of the di_file
        di_dir = os.path.dirname(di_file)
        # Combine directory with new filename
        output_pdf = os.path.join(di_dir, f"{di_basename}.pdf")
    
    # Convert the files
    success = convert_files(di_file, sw_file, output_pdf)
    
    if success:
        print(f"Successfully converted files to {output_pdf}")
    else:
        print("Failed to convert files")

if __name__ == "__main__":
    main()