const schema = process.env.DB_SCHEMA || 'public';

/*
External deployment note:

The export schema trigger currently updates request status and assigned_id in this schema.
After adding requests.export_certificate_no, update export.in_status_trg() to copy the
certificate number from export.sertifikatai.cert_nr.

Previous trigger body:

CREATE OR REPLACE FUNCTION export.in_status_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
 BEGIN
    NEW.id = nextval('export.in_status_seq');
    INSERT INTO "in".request_histories (request_id,type,comment,created_at) VALUES (NEW.rep_id,NEW.rep_status::"in".request_history_type,NEW.rep_comment,timezone('utc'::text, now()));
    UPDATE "in".requests SET status=NEW.rep_status::"in".request_status, assigned_partners = COALESCE(NEW.rep_assigned_partners,assigned_partners), inspector_email=COALESCE(NEW.rep_user,inspector_email), assigned_id=COALESCE(NEW.rep_cert,assigned_id) WHERE id=NEW.rep_id; RETURN NEW; END;
$function$;

Updated trigger body:

CREATE OR REPLACE FUNCTION export.in_status_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  NEW.id = nextval('export.in_status_seq');

  INSERT INTO "in".request_histories (request_id, type, comment, created_at)
  VALUES (
    NEW.rep_id,
    NEW.rep_status::"in".request_history_type,
    NEW.rep_comment,
    timezone('utc'::text, now())
  );

  UPDATE "in".requests r
  SET
    status = NEW.rep_status::"in".request_status,
    assigned_partners = COALESCE(NEW.rep_assigned_partners, r.assigned_partners),
    inspector_email = COALESCE(NEW.rep_user, r.inspector_email),
    assigned_id = COALESCE(NEW.rep_cert, r.assigned_id),
    export_certificate_no = COALESCE(
      (
        SELECT s.cert_nr
        FROM export.sertifikatai s
        WHERE s.id = COALESCE(NEW.rep_cert, r.assigned_id)::int
      ),
      r.export_certificate_no
    )
  WHERE r.id = NEW.rep_id;

  RETURN NEW;
END;
$function$;
*/

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.withSchema(schema).alterTable('requests', (table) => {
    table.string('export_certificate_no').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.withSchema(schema).alterTable('requests', (table) => {
    table.dropColumn('export_certificate_no');
  });
};
