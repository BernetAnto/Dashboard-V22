import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Users, CalendarCheck, Factory, Settings, LogOut, Plus,
  Search, Sun, Moon, Menu, X, Trash2, Pencil, Clock3, CheckCircle2,
  AlertCircle, LockKeyhole, RefreshCw, TrendingUp, ClipboardList, Save,
  ChevronRight, Building2
} from 'lucide-react';
import { supabase } from './lib/supabase';

const today = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
};
const slugify = (value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hoursBetween = (start, end) => {
  if (!start || !end) return 0;
  const a = start.split(':').map(Number), b = end.split(':').map(Number);
  let mins = (b[0]*60+b[1]) - (a[0]*60+a[1]);
  if (mins < 0) mins += 1440;
  return Math.round((mins/60)*100)/100;
};
const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const initialForm = { work_date: today(), orders_quantity: '', idc_quantity: '', rejection_quantity: '' };

export default function App() {
  const [session, setSession] = useState(null);
  const [department, setDepartment] = useState('');
  const [page, setPage] = useState('Overview');
  const [dark, setDark] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [departmentInput, setDepartmentInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [production, setProduction] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [search, setSearch] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [productionForm, setProductionForm] = useState(initialForm);
  const [editingProduction, setEditingProduction] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const userId = session?.user?.id;
  const nav = [
    ['Overview', LayoutDashboard], ['Employees', Users],
    ['Attendance', CalendarCheck], ['Production', Factory], ['Settings', Settings]
  ];

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase || !userId) return;
    const [e, a, p] = await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('attendance').select('*').eq('work_date', selectedDate),
      supabase.from('production_entries').select('*').order('work_date', { ascending: false }).limit(60)
    ]);
    const error = e.error || a.error || p.error;
    if (error) setNotice(error.message);
    else {
      setEmployees(e.data || []);
      setAttendance(a.data || []);
      setProduction(p.data || []);
    }
  }, [userId, selectedDate]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!supabase || !userId) return;
    const channel = supabase.channel('department-live-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees', filter: 'department_id=eq.' + userId }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: 'department_id=eq.' + userId }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_entries', filter: 'department_id=eq.' + userId }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, loadData]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  const runAuth = async (event) => {
    event.preventDefault();
    if (!supabase) { setAuthMessage('Database connection is not configured yet. Add the Supabase URL and anon key in GitHub Actions / environment settings.'); return; }
    const name = departmentInput.trim();
    const key = slugify(name);
    if (!name || !key) { setAuthMessage('Enter a valid department name.'); return; }
    setBusy(true); setAuthMessage('');
    const email = 'dept-' + key + '@dashboard-v22.com';
    let result;
    if (authMode === 'signup') {
      result = await supabase.auth.signUp({ email, password: name, options: { data: { department_name: name } } });
      if (!result.error && !result.data.session) setAuthMessage('Department account created. If email confirmation is enabled, turn it off in Supabase Authentication settings, then log in.');
    } else {
      result = await supabase.auth.signInWithPassword({ email, password: passwordInput });
    }
    if (result?.error) setAuthMessage(result.error.message);
    else if (result?.data?.session) {
      setSession(result.data.session);
      setDepartment(result.data.session.user.user_metadata?.department_name || name);
      setAuthMessage('');
    }
    setBusy(false);
  };

  useEffect(() => {
    if (session?.user) setDepartment(session.user.user_metadata?.department_name || session.user.email || 'Department');
  }, [session]);

  const signOut = async () => { await supabase?.auth.signOut(); setEmployees([]); setAttendance([]); setProduction([]); };
  const saveEmployee = async (event) => {
    event.preventDefault();
    if (!employeeName.trim()) return;
    const payload = { name: employeeName.trim(), department_id: userId };
    const result = editingEmployee
      ? await supabase.from('employees').update(payload).eq('id', editingEmployee.id)
      : await supabase.from('employees').insert(payload);
    if (result.error) setNotice(result.error.message);
    else { setEmployeeName(''); setEditingEmployee(null); setNotice(editingEmployee ? 'Employee updated.' : 'Employee added.'); loadData(); }
  };
  const deleteEmployee = async (id) => {
    if (!window.confirm('Delete this employee and their attendance records?')) return;
    const { error } = await supabase.from('employees').delete().eq('id', id);
    setNotice(error ? error.message : 'Employee deleted.'); loadData();
  };
  const saveAttendance = async (employee, changes) => {
    const current = attendance.find(x => x.employee_id === employee.id);
    const next = { ...(current || {}), ...changes };
    if (next.status === 'absent') { next.check_in = null; next.check_out = null; }
    const worked = hoursBetween(next.check_in, next.check_out);
    const payload = {
      department_id: userId, employee_id: employee.id, work_date: selectedDate,
      status: next.status || 'present', check_in: next.check_in || null,
      check_out: next.check_out || null, total_hours: worked,
      overtime_hours: Math.max(0, Math.round((worked - 8.5) * 100) / 100)
    };
    const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'department_id,employee_id,work_date' });
    if (error) setNotice(error.message);
    else { setNotice('Attendance saved.'); loadData(); }
  };
  const saveProduction = async (event) => {
    event.preventDefault();
    const orders = Number(productionForm.orders_quantity || 0);
    const idc = Number(productionForm.idc_quantity || 0);
    const rejection = Number(productionForm.rejection_quantity || 0);
    const total = orders + idc + rejection;
    const payload = {
      department_id: userId, work_date: productionForm.work_date,
      orders_quantity: orders, idc_quantity: idc, rejection_quantity: rejection,
      total_quantity: total, percentage: total ? ((orders + idc) / total) * 100 : 0
    };
    const result = editingProduction
      ? await supabase.from('production_entries').update(payload).eq('id', editingProduction.id)
      : await supabase.from('production_entries').upsert(payload, { onConflict: 'department_id,work_date' });
    if (result.error) setNotice(result.error.message);
    else { setNotice(editingProduction ? 'Production entry updated.' : 'Production entry saved.'); setProductionForm(initialForm); setEditingProduction(null); loadData(); }
  };
  const editProduction = (item) => {
    setEditingProduction(item);
    setProductionForm({ work_date: item.work_date, orders_quantity: item.orders_quantity, idc_quantity: item.idc_quantity, rejection_quantity: item.rejection_quantity });
    setPage('Production');
  };
  const deleteProduction = async (id) => {
    if (!window.confirm('Delete this production entry?')) return;
    const { error } = await supabase.from('production_entries').delete().eq('id', id);
    setNotice(error ? error.message : 'Production entry deleted.'); loadData();
  };
  const changePassword = async (event) => {
    event.preventDefault();
    if (newPassword.length < 8) { setNotice('Use at least 8 characters for the new password.'); return; }
    if (newPassword !== confirmPassword) { setNotice('Passwords do not match.'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setNotice(error ? error.message : 'Password changed successfully.');
    if (!error) { setNewPassword(''); setConfirmPassword(''); }
  };

  const presentCount = attendance.filter(x => x.status === 'present').length;
  const todayProduction = production.find(x => x.work_date === selectedDate);
  const productionTotal = Number(todayProduction?.total_quantity || 0);
  const filteredEmployees = useMemo(() => employees.filter(x => x.name.toLowerCase().includes(search.toLowerCase())), [employees, search]);

  if (!supabase || !session) return <div className="auth-screen">
    <div className="auth-card">
      <div className="auth-brand"><span className="brandmark">V</span><span>VANTAGE <small>/ DEPARTMENT</small></span></div>
      <div className="auth-icon"><Building2 size={25}/></div>
      <p className="eyebrow">DEPARTMENT WORKSPACE</p>
      <h1>{authMode === 'login' ? 'Welcome back' : 'Create department'}</h1>
      <p className="auth-sub">{authMode === 'login' ? 'Sign in to manage your department.' : 'Create a department account. Its initial password will be the department name.'}</p>
      <form onSubmit={runAuth}>
        <label>Department name<input value={departmentInput} onChange={e=>setDepartmentInput(e.target.value)} placeholder="e.g. Production" required/></label>
        {authMode === 'login' && <label>Password<input type="password" value={passwordInput} onChange={e=>setPasswordInput(e.target.value)} placeholder="Enter department password" required/></label>}
        {authMessage && <div className="auth-message"><AlertCircle size={16}/>{authMessage}</div>}
        <button className="primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create department account'}</button>
      </form>
      <button className="switch-auth" onClick={()=>{setAuthMode(authMode==='login'?'signup':'login');setAuthMessage('');setPasswordInput('');}}>
        {authMode === 'login' ? 'First time here? Create department' : 'Already registered? Sign in'}
      </button>
      <div className="auth-foot"><LockKeyhole size={13}/> Secure department access · Shared online database</div>
    </div>
  </div>;

  return <div className={dark ? 'app dark' : 'app'}>
    {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}/>}
    <aside className={mobileOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span className="brandmark">V</span><span>VANTAGE <small>/ 22</small></span></div>
      <div className="workspace"><div className="avatar"><Building2 size={16}/></div><div><b>{department}</b><small>Department workspace</small></div></div>
      <small className="section-label">MAIN MENU</small>
      <nav>{nav.map(([label, Icon])=><button key={label} className={page===label?'nav active':'nav'} onClick={()=>{setPage(label);setMobileOpen(false);}}><Icon size={18}/>{label}{label==='Employees'&&<span className="count">{employees.length}</span>}</button>)}</nav>
      <div className="side-bottom">
        <div className="help"><div className="help-icon">✦</div><b>Department workspace</b><small>Changes sync across signed-in devices.</small></div>
        <div className="profile"><div className="avatar photo">{department.slice(0,2).toUpperCase()}</div><div><b>{department}</b><small>Department account</small></div><button className="logout-icon" onClick={signOut} title="Sign out"><LogOut size={16}/></button></div>
      </div>
    </aside>
    <main className="main">
      <header>
        <button className="mobile-menu" aria-label={mobileOpen?'Close menu':'Open menu'} onClick={()=>setMobileOpen(v=>!v)}>{mobileOpen?<X/>:<Menu/>}</button>
        <div className="crumb">Department <span>/</span> <b>{page}</b></div>
        <div className="head-actions">
          <label className="search"><Search size={16}/><input placeholder="Search employees…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
          <button className="icon-btn" onClick={()=>setDark(!dark)} title="Toggle theme">{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
          <button className="icon-btn" onClick={loadData} title="Refresh"><RefreshCw size={17}/></button>
        </div>
      </header>
      <div className="content">
        <div className="welcome"><div><div className="eyebrow">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).toUpperCase()}</div><h1>{page==='Overview'?'Department overview':page}</h1><p>Manage employees, attendance and production in one place.</p></div><div className="welcome-date"><CalendarCheck size={16}/><input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/></div></div>
        {notice && <div className="notice"><CheckCircle2 size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
        {page==='Overview' && <>
          <div className="stats">
            <div className="stat glass"><div className="stat-top"><span>Total employees</span><Users size={18}/></div><strong>{employees.length}</strong><small>Registered in this department</small></div>
            <div className="stat glass"><div className="stat-top"><span>Present today</span><CalendarCheck size={18}/></div><strong>{presentCount}<small className="stat-total"> / {employees.length}</small></strong><small>Attendance marked for selected date</small></div>
            <div className="stat glass"><div className="stat-top"><span>Production quantity</span><Factory size={18}/></div><strong>{fmt(productionTotal)}</strong><small>Total output for selected date</small></div>
            <div className="stat glass"><div className="stat-top"><span>Production percentage</span><TrendingUp size={18}/></div><strong>{fmt(todayProduction?.percentage)}%</strong><small>(Orders + IDC) / Total quantity</small></div>
          </div>
          <div className="grid-main">
            <section className="panel glass"><div className="panel-head"><div><h3>Attendance snapshot</h3><p>Employee attendance · {selectedDate}</p></div><button className="text-btn" onClick={()=>setPage('Attendance')}>Manage <ChevronRight size={15}/></button></div>
              <div className="snapshot"><div className="snapshot-ring"><strong>{employees.length ? Math.round((presentCount/employees.length)*100) : 0}%</strong><small>Present</small></div><div className="snapshot-legend"><div><i className="legend-dot present-dot"/><span>Present</span><b>{presentCount}</b></div><div><i className="legend-dot absent-dot"/><span>Absent</span><b>{attendance.filter(x=>x.status==='absent').length}</b></div><div><i className="legend-dot pending-dot"/><span>Not marked</span><b>{Math.max(0,employees.length-attendance.length)}</b></div></div></div>
            </section>
            <section className="panel glass"><div className="panel-head"><div><h3>Production summary</h3><p>Selected date output</p></div><Factory size={18} className="panel-icon"/></div>
              <div className="production-metrics"><div><small>Orders</small><b>{fmt(todayProduction?.orders_quantity)}</b></div><div><small>IDC</small><b>{fmt(todayProduction?.idc_quantity)}</b></div><div><small>Rejection</small><b>{fmt(todayProduction?.rejection_quantity)}</b></div></div>
              <button className="outline full" onClick={()=>setPage('Production')}>View production details <ChevronRight size={15}/></button>
            </section>
          </div>
          <section className="panel glass"><div className="panel-head"><div><h3>Employee list</h3><p>Latest department members</p></div><button className="primary" onClick={()=>setPage('Employees')}><Users size={16}/> Manage employees</button></div><EmployeeTable people={employees.slice(0,5)} onEdit={p=>{setEditingEmployee(p);setEmployeeName(p.name);setPage('Employees');}} onDelete={deleteEmployee}/></section>
        </>}
        {page==='Employees' && <section className="panel glass">
          <div className="panel-head"><div><h3>Employee details</h3><p>Add, edit or remove department employees · {employees.length} total</p></div></div>
          <form className="inline-form" onSubmit={saveEmployee}><label>{editingEmployee?'Edit employee name':'New employee name'}<input value={employeeName} onChange={e=>setEmployeeName(e.target.value)} placeholder="Enter employee full name" required/></label><button className="primary"><Plus size={16}/>{editingEmployee?'Update employee':'Add employee'}</button>{editingEmployee&&<button type="button" className="outline" onClick={()=>{setEditingEmployee(null);setEmployeeName('');}}>Cancel</button>}</form>
          <EmployeeTable people={filteredEmployees} onEdit={p=>{setEditingEmployee(p);setEmployeeName(p.name);}} onDelete={deleteEmployee}/>
        </section>}
        {page==='Attendance' && <section className="panel glass">
          <div className="panel-head"><div><h3>Daily attendance</h3><p>Mark present / absent and enter working time. OT starts after 8.5 hours.</p></div><span className="live"><i/> LIVE DATA</span></div>
          <div className="attendance-summary"><b>{presentCount} Present</b><span>{attendance.filter(x=>x.status==='absent').length} Absent</span><span>{Math.max(0,employees.length-attendance.length)} Not marked</span></div>
          {employees.length===0?<EmptyState text="Add employees first to start marking attendance."/>:<div className="table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>ATTENDANCE</th><th>IN TIME</th><th>OUT TIME</th><th>WORK HRS</th><th>OVERTIME</th></tr></thead><tbody>{employees.map(person=>{const row=attendance.find(x=>x.employee_id===person.id)||{};const worked=hoursBetween(row.check_in,row.check_out);return <tr key={person.id}><td><b className="employee-cell">{person.name}</b></td><td><select className={'status-select '+(row.status||'pending')} value={row.status||''} onChange={e=>saveAttendance(person,{...row,status:e.target.value})}><option value="" disabled>Choose</option><option value="present">Present</option><option value="absent">Absent</option></select></td><td><input className="time-input" type="time" value={(row.check_in||'').slice(0,5)} disabled={row.status==='absent'} onChange={e=>saveAttendance(person,{...row,check_in:e.target.value})}/></td><td><input className="time-input" type="time" value={(row.check_out||'').slice(0,5)} disabled={row.status==='absent'} onChange={e=>saveAttendance(person,{...row,check_out:e.target.value})}/></td><td>{fmt(worked)} h</td><td><b className="ot-value">{fmt(Math.max(0,worked-8.5))} h</b></td></tr>})}</tbody></table></div>}
        </section>}
        {page==='Production' && <div className="production-layout">
          <section className="panel glass"><div className="panel-head"><div><h3>{editingProduction?'Edit production entry':'Production entry'}</h3><p>Enter daily quantities. Totals and percentage calculate automatically.</p></div><Factory size={19} className="panel-icon"/></div>
            <form className="production-form" onSubmit={saveProduction}>
              <label>Production date<input type="date" value={productionForm.work_date} onChange={e=>setProductionForm({...productionForm,work_date:e.target.value})} required/></label>
              <label>Orders quantity<input type="number" min="0" step="1" value={productionForm.orders_quantity} onChange={e=>setProductionForm({...productionForm,orders_quantity:e.target.value})} placeholder="0" required/></label>
              <label>IDC quantity<input type="number" min="0" step="1" value={productionForm.idc_quantity} onChange={e=>setProductionForm({...productionForm,idc_quantity:e.target.value})} placeholder="0" required/></label>
              <label>Rejection quantity<input type="number" min="0" step="1" value={productionForm.rejection_quantity} onChange={e=>setProductionForm({...productionForm,rejection_quantity:e.target.value})} placeholder="0" required/></label>
              <div className="calculated"><div><small>TOTAL QUANTITY</small><b>{fmt(Number(productionForm.orders_quantity||0)+Number(productionForm.idc_quantity||0)+Number(productionForm.rejection_quantity||0))}</b></div><div><small>GOOD OUTPUT %</small><b>{fmt((Number(productionForm.orders_quantity||0)+Number(productionForm.idc_quantity||0))/(Number(productionForm.orders_quantity||0)+Number(productionForm.idc_quantity||0)+Number(productionForm.rejection_quantity||0)||1)*100)}%</b></div></div>
              <div className="form-actions"><button className="primary"><Save size={16}/>{editingProduction?'Update entry':'Save production'}</button>{editingProduction&&<button type="button" className="outline" onClick={()=>{setEditingProduction(null);setProductionForm(initialForm);}}>Cancel</button>}</div>
            </form>
          </section>
          <section className="panel glass"><div className="panel-head"><div><h3>Production history</h3><p>Recent daily production entries</p></div><ClipboardList size={18} className="panel-icon"/></div>
            {production.length===0?<EmptyState text="No production entries yet."/>:<div className="table-wrap"><table><thead><tr><th>DATE</th><th>ORDERS</th><th>IDC</th><th>REJECTION</th><th>TOTAL</th><th>%</th><th>ACTION</th></tr></thead><tbody>{production.map(item=><tr key={item.id}><td>{item.work_date}</td><td>{fmt(item.orders_quantity)}</td><td>{fmt(item.idc_quantity)}</td><td>{fmt(item.rejection_quantity)}</td><td><b>{fmt(item.total_quantity)}</b></td><td><span className="percent-pill">{fmt(item.percentage)}%</span></td><td><div className="row-actions"><button className="icon-action" onClick={()=>editProduction(item)} title="Edit"><Pencil size={15}/></button><button className="icon-action danger" onClick={()=>deleteProduction(item.id)} title="Delete"><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>}
          </section>
        </div>}
        {page==='Settings' && <section className="panel glass settings-panel"><div className="panel-head"><div><h3>Department settings</h3><p>Manage your department account and security.</p></div><Settings size={19} className="panel-icon"/></div><div className="settings-account"><div className="avatar large-avatar"><Building2/></div><div><b>{department}</b><small>Department workspace</small></div></div><form className="password-form" onSubmit={changePassword}><h4>Change password</h4><p>Your initial password is the department name. Choose a new password to secure this account.</p><label>New password<input type="password" minLength="8" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 8 characters" required/></label><label>Confirm new password<input type="password" minLength="8" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter new password" required/></label><button className="primary"><LockKeyhole size={16}/> Update password</button></form><button className="outline signout-button" onClick={signOut}><LogOut size={16}/> Sign out</button></section>}
      </div>
    </main>
  </div>;
}

function EmployeeTable({ people, onEdit, onDelete }) {
  if (!people.length) return <EmptyState text="No employees found. Add an employee to get started."/>;
  return <div className="table-wrap"><table><thead><tr><th>EMPLOYEE NAME</th><th>ADDED</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{people.map(person=><tr key={person.id}><td><b className="employee-cell"><span className="mini-avatar">{person.name.slice(0,1).toUpperCase()}</span>{person.name}</b></td><td>{new Date(person.created_at).toLocaleDateString('en-IN')}</td><td><span className="active-pill">Active</span></td><td><div className="row-actions"><button className="icon-action" onClick={()=>onEdit(person)} title="Edit"><Pencil size={15}/></button><button className="icon-action danger" onClick={()=>onDelete(person.id)} title="Delete"><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>;
}
function EmptyState({text}) { return <div className="empty-state"><Users size={23}/><p>{text}</p></div>; }
