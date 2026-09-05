type Props={content:string;className?:string};
export function ProcedureContent({content,className=""}:Props){
 const blocks=content.replace(/\r\n/g,"\n").split(/\n\s*\n/).filter(Boolean);
 return <div className={`procedure-content ${className}`}>{blocks.map((block,index)=>{const lines=block.split("\n");const list=lines.every(line=>/^\s*(?:[-*•]|\d+[.)])\s+/.test(line));if(list)return <ul key={index}>{lines.map((line,i)=><li key={i}>{line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/,"")}</li>)}</ul>;const heading=lines.length===1&&(/^[A-Z][A-Z\s&:-]+$/.test(block)||/^#{1,6}\s/.test(block));return heading?<h4 key={index}>{block.replace(/^#+\s*/,"")}</h4>:<p key={index} style={{whiteSpace:"pre-wrap"}}>{block}</p>})}</div>;
}
