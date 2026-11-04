export type FinanceRecord={id:string;module:string;payload?:Record<string,any>|null;created_at?:string;updated_at?:string};
const amount=(value:unknown)=>{const n=Number(value??0);return Number.isFinite(n)?Math.max(0,n):0};
const dateKey=(value:unknown)=>{const s=String(value??'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T00:00:00').getTime())?s:''};
const monthKey=(date:string)=>date.slice(0,7);
const addMonths=(month:string,delta:number)=>{const [y,m]=month.split('-').map(Number);const d=new Date(y,m-1+delta,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};
const moneyRound=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
function payments(payload:Record<string,any>){
 const history=Array.isArray(payload.payment_history)?payload.payment_history:[];
 const events=history.map((p:any)=>({amount:amount(p.amount),date:dateKey(p.date||p.paid_date||p.payment_date)})).filter(p=>p.amount>0);
 const historyTotal=events.reduce((sum,p)=>sum+p.amount,0);
 const paidTotal=Math.max(amount(payload.paid_amount),historyTotal,payload.status==='Pago'?amount(payload.amount):0);
 const missing=Math.max(0,Math.min(amount(payload.amount),paidTotal)-historyTotal);
 if(missing>0)events.push({amount:missing,date:dateKey(payload.paid_date)});
 return events;
}
export function calculateFinanceAnalytics(records:FinanceRecord[],today:string,periods=6){
 const validToday=dateKey(today)||new Date().toISOString().slice(0,10),current=monthKey(validToday),count=Math.max(1,Math.min(24,Math.floor(periods)||6));
 const entries=records.filter(r=>r.module==='finance'&&r.payload&&r.payload.status!=='Cancelado').map(r=>{const p=r.payload!,kind=p.kind==='Despesa'?'Despesa':'Receita',total=amount(p.amount),paidEvents=payments(p),paid=Math.min(total,paidEvents.reduce((s,x)=>s+x.amount,0)),balance=Math.max(0,total-paid);return {record:r,p,kind,total,paid,balance,due:dateKey(p.due_date),events:paidEvents,category:String(p.category||'Sem categoria'),company:String(p.company||'Não informada')};});
 const months=Array.from({length:count},(_,i)=>addMonths(current,i-count+1)).map(month=>({month,revenue:0,expenses:0,net:0,receivables:0,payables:0}));
 const byMonth=new Map(months.map(m=>[m.month,m]));
 const categoryMap=new Map<string,{category:string;revenue:number;expenses:number;records:number}>();
 const aging={current:0,days1to30:0,days31to60:0,days61to90:0,over90:0};
 const agingCounts={current:0,days1to30:0,days31to60:0,days61to90:0,over90:0};
 let revenuePaid=0,expensesPaid=0,receivables=0,payables=0,overdueReceivables=0,overduePayables=0,unclassifiedPayments=0,unclassifiedDue=0;
 for(const e of entries){const isRevenue=e.kind==='Receita';if(isRevenue){receivables+=e.balance;revenuePaid+=e.paid}else{payables+=e.balance;expensesPaid+=e.paid;}
  const cat=categoryMap.get(e.category)||{category:e.category,revenue:0,expenses:0,records:0};cat.records++;if(isRevenue)cat.revenue+=e.paid;else cat.expenses+=e.paid;categoryMap.set(e.category,cat);
  for(const event of e.events){if(!event.date){unclassifiedPayments+=event.amount;continue;}const bucket=byMonth.get(monthKey(event.date));if(bucket){if(isRevenue)bucket.revenue+=event.amount;else bucket.expenses+=event.amount;}}
  if(e.balance>0){if(!e.due){unclassifiedDue+=e.balance;continue;}const lateDays=Math.max(0,Math.floor((new Date(validToday+'T00:00:00').getTime()-new Date(e.due+'T00:00:00').getTime())/86400000));const key=lateDays===0?'current':lateDays<=30?'days1to30':lateDays<=60?'days31to60':lateDays<=90?'days61to90':'over90';aging[key]+=e.balance;agingCounts[key]++;if(lateDays>0){if(isRevenue)overdueReceivables+=e.balance;else overduePayables+=e.balance;}}
  if(e.balance>0&&e.due){const bucket=byMonth.get(monthKey(e.due));if(bucket){if(isRevenue)bucket.receivables+=e.balance;else bucket.payables+=e.balance;}}
 }
 for(const m of months)m.net=moneyRound(m.revenue-m.expenses);
 const categoryBreakdown=[...categoryMap.values()].map(x=>({...x,revenue:moneyRound(x.revenue),expenses:moneyRound(x.expenses),net:moneyRound(x.revenue-x.expenses)})).sort((a,b)=>b.expenses-a.expenses||b.revenue-a.revenue);
 return {generatedAt:validToday,periods:months.map(m=>({...m,revenue:moneyRound(m.revenue),expenses:moneyRound(m.expenses),receivables:moneyRound(m.receivables),payables:moneyRound(m.payables)})),totals:{revenuePaid:moneyRound(revenuePaid),expensesPaid:moneyRound(expensesPaid),netCash:moneyRound(revenuePaid-expensesPaid),receivables:moneyRound(receivables),payables:moneyRound(payables),overdueReceivables:moneyRound(overdueReceivables),overduePayables:moneyRound(overduePayables),cashCoverage:expensesPaid?moneyRound(revenuePaid/expensesPaid*100):null,records:entries.length,paymentEvents:entries.reduce((n,e)=>n+e.events.length,0)},aging:Object.fromEntries(Object.entries(aging).map(([k,v])=>[k,moneyRound(v)])),agingCounts,categoryBreakdown,unclassified:{payments:moneyRound(unclassifiedPayments),due:moneyRound(unclassifiedDue)}};
}
