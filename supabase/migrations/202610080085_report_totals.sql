-- Summaries preserve movement direction and aggregate the complete filtered result, before the visible row cap.
do $$declare body text;begin
 body:=pg_get_functiondef('public.operational_report(uuid,text,date,date,uuid,uuid,uuid,uuid,text)'::regprocedure);
 body:=replace(body,'count_rows int;cfg jsonb;', 'count_rows int;cfg jsonb;summary jsonb;');
 body:=replace(body,'(select count(*) from output) into rows,total,count_rows;',
 $totals$(select count(*) from output), (select jsonb_build_object('principal',coalesce(sum((row->>'principal')::numeric),0)::text,'balance',coalesce(sum((row->>'balance')::numeric),0)::text,'provision',coalesce(sum((row->>'provision')::numeric),0)::text,'amount',coalesce(sum(amount),0)::text,'payment',coalesce(sum(amount) filter(where row->>'source'='payment'),0)::text,'disbursement',coalesce(sum(amount) filter(where row->>'source'='disbursement'),0)::text,'reversal',coalesce(sum(amount) filter(where row->>'source'='reversal'),0)::text) from output) into rows,total,count_rows,summary;$totals$);
 body:=replace(body,'''total'',total::text,', '''total'',total::text,''summary'',summary,');execute body;
end;$$;
