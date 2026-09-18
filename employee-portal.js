const SUPABASE_URL="https://rwfamxkfqslorxcryjrp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_tzfe2xVn6OAwF-Mh5_u_zQ_a_bAW7tO";
const portalDb=window.supabase?.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const params=new URLSearchParams(location.search);
const portalKey=params.get("key")||"";
const staffAuthSuffix="@staff.cleancore.local";
const modules=[
  ["dashboard","Overview"],
  ["products","Products & Stock"],
  ["billing","Billing"],
  ["sales","Sales"],
  ["customers","Customers"],
  ["enquiries","Leads / Enquiries"],
  ["website_orders","Website Orders"],
  ["expenses","Expenses"]
];
const moduleLabels=Object.fromEntries(modules);
let employee=null,permissionSet=new Set(),selectedModule="dashboard",records={};

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function money(v){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v||0));}
function fmtDate(v){return v?new Date(v).toLocaleString("en-IN"):"—";}
function inWindow(e){
  const now=Date.now(),start=e.starts_at?new Date(e.starts_at).getTime():-Infinity,end=e.ends_at?new Date(e.ends_at).getTime():Infinity;
  return !!e.active&&now>=start&&now<=end;
}
function signInEmail(username){return String(username||"").trim().toLowerCase()+staffAuthSuffix;}

function setStatus(el,msg,good=false){if(el){el.textContent=msg;el.className="status "+(good?"good":"");}}
function showLogin(){ $("portalLogin").classList.remove("hidden");$("portalApp").classList.add("hidden");}
function showApp(){ $("portalLogin").classList.add("hidden");$("portalApp").classList.remove("hidden");}

async function initSession(){
  if(!portalKey){setStatus($("portalLoginStatus"),"This employee portal link is invalid.");return;}
  const {data}=await portalDb.auth.getSession();
  if(data.session){
    await loadEmployee(data.session.user);
  }
}

async function login(e){
  e.preventDefault();
  setStatus($("portalLoginStatus"),"");
  const username=$("portalUsername").value.trim().toLowerCase();
  const password=$("portalPassword").value;
  if(!username||!password)return setStatus($("portalLoginStatus"),"Enter username and password.");
  const {data,error}=await portalDb.auth.signInWithPassword({email:signInEmail(username),password});
  if(error)return setStatus($("portalLoginStatus"),"Invalid username or password.");
  await loadEmployee(data.user);
}

async function loadEmployee(user){
  const {data,error}=await portalDb.from("employees")
    .select("id,auth_user_id,username,full_name,team,active,starts_at,ends_at,portal_key")
    .eq("auth_user_id",user.id).maybeSingle();
  if(error||!data){
    await portalDb.auth.signOut({scope:"local"});
    return showLogin(),setStatus($("portalLoginStatus"),"Employee account not found.");
  }
  if(String(data.portal_key)!==String(portalKey)){
    await portalDb.auth.signOut({scope:"local"});
    return showLogin(),setStatus($("portalLoginStatus"),"This link is not assigned to this employee.");
  }
  if(!inWindow(data)){
    await portalDb.auth.signOut({scope:"local"});
    return showLogin(),setStatus($("portalLoginStatus"),"This employee access is inactive or outside the allowed time.");
  }
  employee=data;
  const {data:perms,error:perr}=await portalDb.from("employee_permissions")
    .select("module").eq("employee_id",employee.id).eq("enabled",true);
  if(perr){
    await portalDb.auth.signOut({scope:"local"});
    return showLogin(),setStatus($("portalLoginStatus"),"Unable to load your permissions.");
  }
  permissionSet=new Set((perms||[]).map(x=>x.module));
  showApp();
  renderPortal();
  await selectModule(permissionSet.has("dashboard")?"dashboard":[...permissionSet][0]||"dashboard");
}

function renderPortal(){
  $("portalEmployeeName").textContent=employee.full_name||employee.username;
  $("portalEmployeeMeta").textContent=employee.username;
  $("portalTitle").textContent=(employee.team==="account"?"Account Team":employee.team==="crm"?"CRM Team":"Team")+" workspace";
  $("portalTeamBadge").textContent=employee.team==="custom"?"Custom":employee.team==="account"?"Account Team":"CRM Team";
  const start=employee.starts_at?fmtDate(employee.starts_at):"Immediately";
  const end=employee.ends_at?fmtDate(employee.ends_at):"No end time";
  $("portalAccessWindow").textContent="Access window: "+start+" → "+end;

  const available=modules.filter(([id])=>permissionSet.has(id));
  $("portalModuleGrid").innerHTML=available.map(([id,label])=>
    "<button class='module-tile "+(id===selectedModule?"active":"")+"' data-module='"+id+"'><strong>"+esc(label)+"</strong><span>Open workspace</span></button>"
  ).join("")||"<div class='empty'>No sections have been assigned.</div>";

  document.querySelectorAll(".module-tile").forEach(b=>b.onclick=()=>selectModule(b.dataset.module));
  const options=modules.filter(([id])=>!permissionSet.has(id));
  $("portalAccessModule").innerHTML=options.map(([id,label])=>"<option value='"+id+"'>"+esc(label)+"</option>").join("");
  if(!options.length){
    $("portalAccessModule").innerHTML="<option value=''>All sections already assigned</option>";
    $("portalAccessForm").querySelector("button").disabled=true;
  }
}

async function selectModule(module){
  if(module!=="dashboard"&&!permissionSet.has(module))return;
  selectedModule=module;
  renderPortal();
  $("portalModuleTitle").textContent=moduleLabels[module]||module;
  $("portalModuleHint").textContent=module==="dashboard"?"Your assigned workspace summary.":"Read-only business data for this assigned section.";
  $("portalDataArea").innerHTML="<div class='loading'>Loading…</div>";
  if(module==="dashboard"){renderDashboard();return;}
  const data=await fetchModule(module);
  renderTable(module,data);
}

async function fetchModule(module){
  if(records[module])return records[module];
  let query=null;
  if(module==="products")query=portalDb.from("products").select("name,unit,selling_price,stock,low_stock_threshold").order("name").limit(200);
  else if(module==="billing"||module==="sales")query=portalDb.from("invoices").select("invoice_no,customer_name,total,paid_amount,due_amount,payment_status,created_at").order("created_at",{ascending:false}).limit(200);
  else if(module==="customers")query=portalDb.from("customers").select("name,business_name,phone,email").order("name").limit(200);
  else if(module==="enquiries")query=portalDb.from("enquiries").select("name,phone,business,product_name,quantity,status,created_at").order("created_at",{ascending:false}).limit(200);
  else if(module==="website_orders")query=portalDb.from("website_orders").select("order_no,total,status,created_at").order("created_at",{ascending:false}).limit(200);
  else if(module==="expenses")query=portalDb.from("expenses").select("expense_date,category,amount,vendor").order("expense_date",{ascending:false}).limit(200);
  if(!query)return [];
  const {data,error}=await query;
  if(error)throw new Error(error.message);
  records[module]=data||[];
  return records[module];
}

function renderDashboard(){
  const summary=[];
  const map=[
    ["products","Products",r=>r.length],
    ["billing","Bills",r=>r.length],
    ["sales","Sales records",r=>r.length],
    ["customers","Customers",r=>r.length],
    ["enquiries","Leads",r=>r.length],
    ["website_orders","Website orders",r=>r.length],
    ["expenses","Expenses",r=>money(r.reduce((a,x)=>a+Number(x.amount||0),0))]
  ];
  $("portalDataArea").innerHTML="<div class='summary-grid'>"+map.filter(x=>permissionSet.has(x[0])).map(x=>{
    const data=records[x[0]]||[];
    return "<div class='summary-item'><span>"+esc(x[1])+"</span><strong id='sum-"+x[0]+"'>Loading</strong></div>";
  }).join("")+"</div>";
  map.filter(x=>permissionSet.has(x[0])).forEach(async x=>{
    try{
      const data=await fetchModule(x[0]);
      $("sum-"+x[0]).textContent=String(x[2](data));
    }catch{
      $("sum-"+x[0]).textContent="—";
    }
  });
}

function renderTable(module,data){
  let head=[],rows=[];
  if(module==="products"){head=["Product","Unit","Price","Stock","Low stock"];rows=data.map(x=>[x.name,x.unit,money(x.selling_price),x.stock,x.low_stock_threshold]);}
  else if(module==="billing"||module==="sales"){head=["Invoice","Customer","Total","Paid","Credit","Status","Date"];rows=data.map(x=>[x.invoice_no,x.customer_name,money(x.total),money(x.paid_amount),money(x.due_amount),x.payment_status||"Credit",fmtDate(x.created_at)]);}
  else if(module==="customers"){head=["Customer","Business","Phone","Email"];rows=data.map(x=>[x.name,x.business_name||"—",x.phone||"—",x.email||"—"]);}
  else if(module==="enquiries"){head=["Name","Phone","Business","Product","Qty","Status","Date"];rows=data.map(x=>[x.name,x.phone||"—",x.business||"—",x.product_name||"—",x.quantity??"—",x.status||"New",fmtDate(x.created_at)]);}
  else if(module==="website_orders"){head=["Order","Total","Status","Date"];rows=data.map(x=>[x.order_no,money(x.total),x.status,fmtDate(x.created_at)]);}
  else if(module==="expenses"){head=["Date","Category","Amount","Vendor"];rows=data.map(x=>[x.expense_date,x.category,money(x.amount),x.vendor||"—"]);}
  const table="<div class='table-wrap'><table><thead><tr>"+head.map(h=>"<th>"+esc(h)+"</th>").join("")+"</tr></thead><tbody>"+
    (rows.length?rows.map(row=>"<tr>"+row.map(v=>"<td>"+esc(v)+"</td>").join("")+"</tr>").join(""):"<tr><td colspan='"+head.length+"'>No records found.</td></tr>")+
    "</tbody></table></div>";
  $("portalDataArea").innerHTML=table;
}

async function requestAccess(e){
  e.preventDefault();
  const module=$("portalAccessModule").value;
  const reason=$("portalAccessReason").value.trim();
  if(!module)return setStatus($("portalAccessStatus"),"All available sections are already assigned.");
  if(!reason)return setStatus($("portalAccessStatus"),"Enter a reason for the request.");
  setStatus($("portalAccessStatus"),"Sending request…");
  const {data,error}=await portalDb.rpc("request_additional_access",{p_module:module,p_reason:reason});
  if(error)return setStatus($("portalAccessStatus"),error.message);
  $("portalAccessReason").value="";
  setStatus($("portalAccessStatus"),"Request sent to Manager.",true);
  await loadAccessHistory();
}

async function loadAccessHistory(){
  const {data}=await portalDb.from("access_requests").select("module,reason,status,created_at,action").eq("employee_id",employee.id).order("created_at",{ascending:false}).limit(20);
  const rows=(data||[]).filter(x=>x.action==="REQUEST_ACCESS");
  $("portalAccessHistory").innerHTML=rows.length
    ? "<h3>My access requests</h3><div class='ticket-list'>"+rows.map(x=>"<div class='ticket'><div><strong>"+esc(moduleLabels[x.module]||x.module)+"</strong><span>"+esc(x.reason)+"</span></div><b>"+esc(x.status||"Pending")+"</b></div>").join("")+"</div>"
    : "<p class='tiny muted'>No access requests yet.</p>";
}

$("portalLoginForm").addEventListener("submit",login);
$("portalLogout").onclick=async()=>{await portalDb.auth.signOut({scope:"local"});location.reload()};
$("portalAccessForm").addEventListener("submit",requestAccess);
document.addEventListener("DOMContentLoaded",async()=>{await initSession();if(employee)await loadAccessHistory();});
portalDb?.auth.onAuthStateChange(async(_event,session)=>{if(!session&&!employee)showLogin();});
