CREATE TABLE app_user
(
    id                   BIGSERIAL PRIMARY KEY,
    name                 VARCHAR(100) NOT NULL,
    username             VARCHAR(50)  NOT NULL UNIQUE,
    oib                  VARCHAR(11)  NOT NULL,
    password_hash        VARCHAR(255) NOT NULL,
    default_warehouse_id BIGINT,
    created_at           TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_oib ON app_user (oib);
CREATE INDEX idx_user_username ON app_user (username);

CREATE TABLE role
(
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE user_role
(
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_role_user
        FOREIGN KEY (user_id)
            REFERENCES app_user (id)
            ON DELETE CASCADE,
    CONSTRAINT fk_user_role_role
        FOREIGN KEY (role_id)
            REFERENCES role (id)
            ON DELETE CASCADE
);

INSERT INTO role (name)
VALUES ('USER');

CREATE TABLE dispatch_template_folder
(
    id            BIGSERIAL PRIMARY KEY,
    owner_user_id BIGINT       NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    parent_id     BIGINT REFERENCES dispatch_template_folder (id) ON DELETE CASCADE,
    name          VARCHAR(160) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_dt_folder_owner_parent_name_ci
    ON dispatch_template_folder (owner_user_id, parent_id, lower(name));

CREATE INDEX idx_dt_folder_owner ON dispatch_template_folder (owner_user_id);
CREATE INDEX idx_dt_folder_parent ON dispatch_template_folder (parent_id);


CREATE TABLE dispatch_template
(
    id             BIGSERIAL PRIMARY KEY,
    owner_user_id  BIGINT       NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    folder_id      BIGINT       REFERENCES dispatch_template_folder (id) ON DELETE SET NULL,
    household_size SMALLINT     NOT NULL CHECK (household_size BETWEEN 1 AND 5),
    name           VARCHAR(200) NOT NULL,
    description    TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_dt_template_owner_folder_name_size_ci
    ON dispatch_template (owner_user_id, folder_id, household_size, lower(name));

CREATE INDEX idx_dt_template_owner ON dispatch_template (owner_user_id);
CREATE INDEX idx_dt_template_folder ON dispatch_template (folder_id);


CREATE TABLE dispatch_template_doc
(
    id           BIGSERIAL PRIMARY KEY,
    template_id  BIGINT  NOT NULL REFERENCES dispatch_template (id) ON DELETE CASCADE,
    sort_order   INT     NOT NULL DEFAULT 0,
    document_id  BIGINT  NOT NULL,
    draft        BOOLEAN NOT NULL DEFAULT FALSE,
    default_note TEXT
);

CREATE UNIQUE INDEX ux_dt_template_doc_unique
    ON dispatch_template_doc (template_id, document_id);

CREATE INDEX idx_dt_template_doc_template ON dispatch_template_doc (template_id);


CREATE TABLE dispatch_template_doc_item
(
    id              BIGSERIAL PRIMARY KEY,
    template_doc_id BIGINT         NOT NULL REFERENCES dispatch_template_doc (id) ON DELETE CASCADE,
    sort_order      INT            NOT NULL DEFAULT 0,
    item_id         BIGINT         NOT NULL,
    quantity        NUMERIC(15, 5) NOT NULL
);

CREATE UNIQUE INDEX ux_dt_template_doc_item_unique
    ON dispatch_template_doc_item (template_doc_id, item_id);

CREATE INDEX idx_dt_template_doc_item_doc ON dispatch_template_doc_item (template_doc_id);

CREATE TABLE dispatch_template_share
(
    id                  BIGSERIAL PRIMARY KEY,
    template_id         BIGINT      NOT NULL REFERENCES dispatch_template (id) ON DELETE CASCADE,
    shared_with_user_id BIGINT      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    permission          VARCHAR(20) NOT NULL DEFAULT 'BOOK',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_dt_share_template_user
    ON dispatch_template_share (template_id, shared_with_user_id);

CREATE INDEX idx_dt_share_template
    ON dispatch_template_share (template_id);

CREATE INDEX idx_dt_share_shared_with
    ON dispatch_template_share (shared_with_user_id);

CREATE TABLE dispatch_booking_session
(
    id            BIGSERIAL PRIMARY KEY,
    owner_user_id BIGINT NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,

    title         VARCHAR(200) NOT NULL,
    note          TEXT,

    warehouse_id  BIGINT NOT NULL,
    document_date DATE NOT NULL DEFAULT CURRENT_DATE,

    status        VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT / FINALIZED / CANCELLED

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalized_at  TIMESTAMPTZ,

    final_result  JSONB
);

CREATE INDEX idx_dbs_owner  ON dispatch_booking_session(owner_user_id);
CREATE INDEX idx_dbs_status ON dispatch_booking_session(status);


-- =========================================================
-- DISPATCH BOOKING SESSION ENTRY
-- =========================================================
-- One entry per partner inside a session:
-- - template_id (current template always used at finalize)
-- - doc_patches JSONB: list of { documentId, addItems:[{itemId, quantity}] }
-- - extra_items JSONB: list of { itemId, quantity } applied to first template doc

CREATE TABLE dispatch_booking_session_entry
(
    id            BIGSERIAL PRIMARY KEY,
    session_id    BIGINT NOT NULL REFERENCES dispatch_booking_session(id) ON DELETE CASCADE,

    partner_id    BIGINT NOT NULL,
    template_id   BIGINT NOT NULL,

    draft_mode    VARCHAR(10) NOT NULL DEFAULT 'DRAFT', -- DRAFT / FINAL

    document_date DATE,

    doc_patches   JSONB NOT NULL DEFAULT '[]'::jsonb,
    extra_items   JSONB NOT NULL DEFAULT '[]'::jsonb,

    note          TEXT,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_dbse_draft_mode CHECK (draft_mode IN ('DRAFT','FINAL'))
);

CREATE UNIQUE INDEX ux_dbse_session_partner ON dispatch_booking_session_entry(session_id, partner_id);
CREATE INDEX idx_dbse_session  ON dispatch_booking_session_entry(session_id);
CREATE INDEX idx_dbse_template ON dispatch_booking_session_entry(template_id);