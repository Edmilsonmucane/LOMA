-- Editable initial data, not statutory or financial policy. Rates remain unset until M2.
insert into public.plans(id,name,limits,features) values('10000000-0000-4000-8000-000000000001','Essencial','{"users":20,"active_loans":1000,"messages":5000}','{"campaigns":true}');
insert into public.presets(id,name,configuration) values('20000000-0000-4000-8000-000000000001','Microcrédito mensal',jsonb_build_object(
 'roles','[
 {"key":"manager","name":"Gestor","permissions":["tenant.read","tenant.manage","users.manage","audit.read","clients.read","clients.manage","applications.read","applications.manage","loans.read","payments.manage","collections.manage","messages.manage","reports.read"]},
 {"key":"analyst","name":"Analista de crédito","permissions":["tenant.read","clients.read","clients.manage","applications.read","applications.manage","loans.read","reports.read"]},
 {"key":"cashier","name":"Caixa","permissions":["tenant.read","clients.read","loans.read","payments.manage","reports.read"]},
 {"key":"collector","name":"Cobrador","permissions":["tenant.read","clients.read","loans.read","payments.manage","collections.manage"]},
 {"key":"reader","name":"Leitura","permissions":["tenant.read","clients.read","applications.read","loans.read","reports.read"]}
 ]'::jsonb,
 'products','[
 {"key":"personal","name":"Crédito pessoal mensal","method":"annuity","periodicity":"monthly","min_periods":3,"max_periods":12,"rate":null,"active":false},
 {"key":"salary","name":"Crédito consignado","method":"flat","periodicity":"monthly","rate":null,"active":false},
 {"key":"merchant","name":"Crédito para comerciantes","method":"flat","periodicity":"daily","rate":null,"active":false},
 {"key":"business","name":"Crédito PME","method":"annuity","periodicity":"monthly","rate":null,"active":false}
 ]'::jsonb,
 'messages','[{"key":"received","name":"Pedido recebido","body":"Olá {nome}. Recebemos o seu pedido {numero}. A nossa equipa irá contactá-lo.","active":false},{"key":"reminder","name":"Lembrete de prestação","body":"Olá {nome}. A sua prestação de {valor} vence a {data}. Contacte a sua agência se precisar de ajuda.","active":false}]'::jsonb,
 'site','{"theme":"classic","title":"Crédito para o próximo passo.","description":"Converse com a nossa equipa para encontrar uma solução adequada.","published":false}'::jsonb));
insert into public.presets(name,configuration) select 'Comerciantes e pequenos negócios',jsonb_set(configuration,'{site,title}','"O seu negócio, em movimento."') from public.presets where id='20000000-0000-4000-8000-000000000001';
