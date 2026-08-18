import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib"
import { INVOICE_TEMPLATE_VERSION, type InvoiceDocumentData } from "@/lib/invoice-document"
import { formatGbp } from "@/lib/invoice-ui"

const PAGE = { width: 595.28, height: 841.89, left: 44, right: 44, bottom: 58 }
const C = { ink: rgb(.06,.1,.18), muted: rgb(.35,.4,.48), line: rgb(.82,.85,.89), accent: rgb(.02,.66,.78), pale: rgb(.94,.98,.99), white: rgb(1,1,1), danger: rgb(.75,.08,.12), success: rgb(.02,.48,.3) }

export async function renderInvoicePdf(data: InvoiceDocumentData) {
  if (data.templateVersion !== INVOICE_TEMPLATE_VERSION) throw new Error(`Unsupported invoice template version: ${data.templateVersion}`)
  return renderV1(data)
}

export function invoicePdfFilename(data: InvoiceDocumentData) {
  return data.invoiceNumber ? `${data.invoiceNumber.replace(/[^A-Z0-9-]/gi, "-")}.pdf` : "ScaleSmiths-Invoice-Draft.pdf"
}

export function invoicePdfTextFragments(data: InvoiceDocumentData) {
  return [data.invoiceNumber ?? "DRAFT", data.supplier.legalName, data.supplier.tradingName, ...address(data.supplier), data.customer.businessName, data.customer.contactName, data.customer.email, ...address(data.customer), ...data.items.flatMap(item => [item.title, item.description, String(item.quantity), formatGbp(item.unitAmount), formatGbp(item.lineAmount)]), data.customerNote, data.payment.instructions, data.payment.accountName, data.payment.sortCode, data.payment.accountNumber, data.payment.referenceInstructions, formatGbp(data.subtotal), formatGbp(data.total)].filter((value): value is string => Boolean(value))
}

async function renderV1(data: InvoiceDocumentData) {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const logo = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "brand", "scalesmiths-wordmark.png")))
  const stableDate = new Date(`${data.issuedDate ?? data.invoiceDate}T00:00:00Z`)
  pdf.setTitle(data.invoiceNumber ? `Invoice ${data.invoiceNumber}` : "ScaleSmiths Invoice Draft")
  pdf.setAuthor("ScaleSmiths"); pdf.setCreator(`ScaleSmiths ${data.templateVersion}`); pdf.setCreationDate(stableDate); pdf.setModificationDate(stableDate)
  let page = pdf.addPage([PAGE.width, PAGE.height])
  let y = parties(page, header(page, data, regular, bold, logo), data, regular, bold) - 24
  y = tableHead(page, y, bold)
  for (const [index, item] of data.items.entries()) {
    const titles = wrap(item.title, bold, 9.5, 270)
    const descriptions = item.description ? wrap(item.description, regular, 8, 270) : []
    const height = Math.max(34, 13 + titles.length * 11 + descriptions.length * 9)
    if (y - height < PAGE.bottom + 70) { page = pdf.addPage([PAGE.width, PAGE.height]); y = tableHead(page, continued(page, data, regular, bold), bold) }
    page.drawRectangle({ x: PAGE.left, y: y-height, width: PAGE.width-PAGE.left-PAGE.right, height, color: index%2 ? C.white : C.pale })
    let ty = y-15
    for (const line of titles) { draw(page,line,PAGE.left+8,ty,9.5,bold); ty-=11 }
    for (const line of descriptions) { draw(page,line,PAGE.left+8,ty,8,regular,C.muted); ty-=9 }
    right(page,String(item.quantity),391,y-17,9,regular); right(page,formatGbp(item.unitAmount),475,y-17,9,regular); right(page,formatGbp(item.lineAmount),PAGE.width-PAGE.right-7,y-17,9,bold)
    y -= height
  }
  if (y < PAGE.bottom+190) { page=pdf.addPage([PAGE.width,PAGE.height]); y=continued(page,data,regular,bold) }
  y-=18; totals(page,y,data,regular,bold); y-=92
  if (data.customerNote) { const lines=wrap(data.customerNote,regular,9,475); if (y-lines.length*11<PAGE.bottom+28) { page=pdf.addPage([PAGE.width,PAGE.height]); y=continued(page,data,regular,bold) } y=section(page,y,"NOTE / REFERENCE",lines,regular,bold) }
  const payment=paymentLines(data)
  if (payment.length) { if (y-payment.length*11<PAGE.bottom+28) { page=pdf.addPage([PAGE.width,PAGE.height]); y=continued(page,data,regular,bold) } section(page,y,"HOW TO PAY",payment,regular,bold) }
  for (const [index,current] of pdf.getPages().entries()) footer(current,data,regular,index+1,pdf.getPageCount())
  return pdf.save({ useObjectStreams:false })
}

function header(page:PDFPage,data:InvoiceDocumentData,regular:PDFFont,bold:PDFFont,logo:PDFImage) { const scale=Math.min(155/logo.width,38/logo.height); page.drawImage(logo,{x:PAGE.left,y:750,width:logo.width*scale,height:logo.height*scale}); right(page,"INVOICE",PAGE.width-PAGE.right,780,23,bold); right(page,data.invoiceNumber??"DRAFT",PAGE.width-PAGE.right,759,12,bold,data.invoiceNumber?C.accent:C.danger); status(page,data,bold); draw(page,"Invoice Date",PAGE.left,717,8,bold,C.muted); draw(page,date(data.invoiceDate),PAGE.left,702,10,regular); draw(page,"Due Date",PAGE.left+130,717,8,bold,C.muted); draw(page,date(data.dueDate),PAGE.left+130,702,10,regular); page.drawLine({start:{x:PAGE.left,y:687},end:{x:PAGE.width-PAGE.right,y:687},thickness:1,color:C.line}); return 665 }
function continued(page:PDFPage,data:InvoiceDocumentData,regular:PDFFont,bold:PDFFont) { draw(page,"SCALESMITHS",PAGE.left,794,11,bold); right(page,`${data.invoiceNumber??"DRAFT"} - continued`,PAGE.width-PAGE.right,794,9,regular,C.muted); return 767 }
function parties(page:PDFPage,y:number,data:InvoiceDocumentData,regular:PDFFont,bold:PDFFont) { draw(page,"FROM",PAGE.left,y,8,bold,C.accent); draw(page,"BILL TO",310,y,8,bold,C.accent); const supplier=[data.supplier.legalName||data.supplier.tradingName,data.supplier.legalName&&data.supplier.tradingName?data.supplier.tradingName:null,...address(data.supplier),data.supplier.contactEmail].filter(Boolean) as string[]; const customer=[data.customer.businessName,data.customer.contactName,...address(data.customer),data.customer.email].filter(Boolean) as string[]; const sl=supplier.flatMap((line,i)=>wrap(line,i?regular:bold,i?8.5:10,220)); const cl=customer.flatMap((line,i)=>wrap(line,i?regular:bold,i?8.5:10,220)); const rows=Math.max(sl.length,cl.length); for(let i=0;i<rows;i++){if(sl[i])draw(page,sl[i],PAGE.left,y-18-i*12,i?8.5:10,i?regular:bold,i?C.muted:C.ink);if(cl[i])draw(page,cl[i],310,y-18-i*12,i?8.5:10,i?regular:bold,i?C.muted:C.ink)} return y-24-rows*12 }
function tableHead(page:PDFPage,y:number,bold:PDFFont) { page.drawRectangle({x:PAGE.left,y:y-24,width:PAGE.width-PAGE.left-PAGE.right,height:24,color:C.ink}); draw(page,"DESCRIPTION",PAGE.left+8,y-16,8,bold,C.white); right(page,"QTY",391,y-16,8,bold,C.white); right(page,"RATE",475,y-16,8,bold,C.white); right(page,"AMOUNT",PAGE.width-PAGE.right-7,y-16,8,bold,C.white); return y-24 }
function totals(page:PDFPage,y:number,data:InvoiceDocumentData,regular:PDFFont,bold:PDFFont) { const x=350; draw(page,"Subtotal",x,y,9,regular,C.muted); right(page,formatGbp(data.subtotal),PAGE.width-PAGE.right,y,10,regular); page.drawLine({start:{x,y:y-13},end:{x:PAGE.width-PAGE.right,y:y-13},thickness:1,color:C.line}); draw(page,"TOTAL",x,y-38,11,bold); right(page,formatGbp(data.total),PAGE.width-PAGE.right,y-39,16,bold,C.accent) }
function section(page:PDFPage,y:number,title:string,lines:string[],regular:PDFFont,bold:PDFFont) { draw(page,title,PAGE.left,y,8,bold,C.accent); let next=y-16; for(const line of lines){draw(page,line,PAGE.left,next,8.5,regular,C.muted);next-=11} return next-12 }
function paymentLines(data:InvoiceDocumentData) { const p=data.payment; return [p.instructions,p.accountName?`Account name: ${p.accountName}`:null,p.sortCode?`Sort code: ${p.sortCode}`:null,p.accountNumber?`Account number: ${p.accountNumber}`:null,p.referenceInstructions,data.invoiceNumber?`Payment reference: ${data.invoiceNumber}`:null].filter(Boolean).flatMap(row=>wrapText(String(row),90)) }
function status(page:PDFPage,data:InvoiceDocumentData,bold:PDFFont) { if(data.documentState==="issued")return; const label=data.documentState.toUpperCase(); const color=data.documentState==="paid"?C.success:C.danger; page.drawRectangle({x:PAGE.width-PAGE.right-88,y:724,width:88,height:21,borderColor:color,borderWidth:1}); right(page,label,PAGE.width-PAGE.right-8,730,9,bold,color) }
function footer(page:PDFPage,data:InvoiceDocumentData,regular:PDFFont,n:number,count:number) { page.drawLine({start:{x:PAGE.left,y:40},end:{x:PAGE.width-PAGE.right,y:40},thickness:.7,color:C.line}); const details=[data.supplier.website,data.supplier.contactEmail,data.supplier.companyNumber?`Company ${data.supplier.companyNumber}`:null,data.supplier.vatNumber?`VAT ${data.supplier.vatNumber}`:null].filter(Boolean).join(" | "); draw(page,details,PAGE.left,25,7,regular,C.muted); right(page,`${n} / ${count}`,PAGE.width-PAGE.right,25,7,regular,C.muted) }
function address(v:{addressLine1:string|null;addressLine2:string|null;city:string|null;county:string|null;postcode:string|null;country:string|null}) { return [v.addressLine1,v.addressLine2,[v.city,v.county].filter(Boolean).join(", "),v.postcode,v.country].filter(Boolean) as string[] }
function wrap(text:string,font:PDFFont,size:number,maxWidth:number) { const words=safe(text).replace(/\s+/g," ").trim().split(" ").flatMap(w=>splitWord(w,font,size,maxWidth)); const lines:string[]=[]; let line=""; for(const word of words){const candidate=line?`${line} ${word}`:word;if(font.widthOfTextAtSize(candidate,size)<=maxWidth)line=candidate;else{if(line)lines.push(line);line=word}}if(line)lines.push(line);return lines.length?lines:[""] }
function splitWord(word:string,font:PDFFont,size:number,maxWidth:number) { if(font.widthOfTextAtSize(word,size)<=maxWidth)return[word];const parts:string[]=[];let part="";for(const ch of word){const candidate=part+ch;if(part&&font.widthOfTextAtSize(candidate,size)>maxWidth){parts.push(part);part=ch}else part=candidate}if(part)parts.push(part);return parts }
function wrapText(text:string,max:number) { const lines:string[]=[];let line="";for(const word of text.split(/\s+/)){if(`${line} ${word}`.trim().length<=max)line=`${line} ${word}`.trim();else{if(line)lines.push(line);line=word}}if(line)lines.push(line);return lines }
function draw(page:PDFPage,text:string,x:number,y:number,size:number,font:PDFFont,color=C.ink){page.drawText(safe(text),{x,y,size,font,color})}
function right(page:PDFPage,text:string,x:number,y:number,size:number,font:PDFFont,color=C.ink){const value=safe(text);draw(page,value,x-font.widthOfTextAtSize(value,size),y,size,font,color)}
function safe(value:string){return value.replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/[\u2013\u2014]/g,"-").replace(/\u2026/g,"...").replace(/[^\u0020-\u007E\u00A0-\u00FF]/g,"?")}
function date(value:string){return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(`${value}T00:00:00Z`))}
