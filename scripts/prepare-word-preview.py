"""Prepare static, structured previews from the downloadable Word documents."""
import hashlib
import io
import json
import re
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / 'bank/oxford/catalog.json'
ASSETS = ROOT / 'bank/oxford/preview-media'


def local_name(element):
    return element.tag.rsplit('}', 1)[-1]


class Preview:
    def __init__(self, document):
        self.document = document
        self.images = {}
        self.unsupported = set()

    def image(self, relationship, label='Document image'):
        if relationship in self.images:
            return self.images[relationship]
        relation = self.document.part.rels.get(relationship)
        if relation is None or relation.is_external:
            return None
        part = relation.target_part
        extension = Path(str(part.partname)).suffix.lower()
        try:
            data = part.blob
            if extension not in ('.png', '.jpg', '.jpeg', '.gif', '.webp'):
                with Image.open(io.BytesIO(data)) as picture:
                    output = io.BytesIO()
                    picture.convert('RGB').save(output, format='PNG')
                    data = output.getvalue()
                extension = '.png'
            filename = hashlib.sha256(data).hexdigest()[:24] + extension
            (ASSETS / filename).write_bytes(data)
            item = {'type': 'image', 'path': 'bank/oxford/preview-media/' + filename, 'alt': label}
        except (OSError, ValueError):
            self.unsupported.add(str(part.partname))
            item = {'type': 'unavailable', 'text': 'This image is available in the downloaded Word file.'}
        self.images[relationship] = item
        return item

    def paragraph(self, element, parent):
        paragraph = Paragraph(element, parent)
        runs = []
        for run in paragraph.runs:
            if run.text:
                item = {'type': 'text', 'text': run.text}
                for key in ('bold', 'italic', 'underline'):
                    if getattr(run, key):
                        item[key] = True
                if run.font.subscript:
                    item['vertical'] = 'sub'
                elif run.font.superscript:
                    item['vertical'] = 'super'
                if run.font.size:
                    item['size'] = max(8, min(26, run.font.size.pt))
                runs.append(item)
        # Some Word paragraphs place text in fields or hyperlinks rather than runs.
        if not runs and paragraph.text:
            runs.append({'type': 'text', 'text': paragraph.text})
        seen = set()
        for node in element.iter():
            relationship = node.get(qn('r:embed')) or node.get(qn('r:id'))
            if local_name(node) not in ('blip', 'imagedata') or not relationship or relationship in seen:
                continue
            seen.add(relationship)
            item = self.image(relationship)
            if item:
                runs.append(item)
        style = paragraph.style.name if paragraph.style else ''
        text = paragraph.text.strip()
        heading = 1 if style == 'Title' or re.match(r'^Chapter\s+\d+\b', text, re.I) else 2 if style.startswith('Heading') or text in ('Multiple-choice questions', 'Short questions', 'Long questions', 'Essay questions', 'Text edition') else 0
        alignment = {1: 'center', 2: 'right', 3: 'justify'}.get(paragraph.alignment, 'left')
        page_break = bool(paragraph.paragraph_format.page_break_before or element.xpath('.//w:br[@w:type="page"]'))
        return {'type': 'paragraph', 'runs': runs, 'heading': heading, 'align': alignment, 'pageBreak': page_break}

    def blocks(self, element, parent):
        result = []
        for child in element:
            if child.tag == qn('w:p'):
                result.append(self.paragraph(child, parent))
            elif child.tag == qn('w:tbl'):
                table = Table(child, parent)
                rows = []
                for row in table.rows:
                    cells, previous = [], None
                    for cell in row.cells:
                        if cell._tc is previous:
                            cells[-1]['span'] += 1
                            continue
                        previous = cell._tc
                        cells.append({'span': 1, 'blocks': self.blocks(cell._tc, cell)})
                    rows.append(cells)
                result.append({'type': 'table', 'rows': rows})
        return result


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    total_images = 0
    for source in catalog['sources']:
        document = Document(ROOT / source['downloadPath'])
        preview = Preview(document)
        blocks = preview.blocks(document.element.body, document)
        output = {'version': 1, 'edition': source['wordEdition'], 'sourceHash': hashlib.sha256((ROOT / source['downloadPath']).read_bytes()).hexdigest(), 'blocks': blocks, 'unsupportedImages': len(preview.unsupported)}
        destination = 'bank/oxford/' + source['id'] + '.preview.json'
        (ROOT / destination).write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        source['wordPreviewPath'] = destination
        total_images += len(preview.images)
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f"Prepared {len(catalog['sources'])} Word previews with {total_images} image references.")


if __name__ == '__main__':
    main()
