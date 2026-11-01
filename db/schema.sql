\restrict dbmate

-- Dumped from database version 17.11 (Ubuntu 17.11-1.pgdg24.04+2)
-- Dumped by pg_dump version 17.11 (Ubuntu 17.11-1.pgdg24.04+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: site_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.site_role AS ENUM (
    'admin'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    hostname text NOT NULL,
    CONSTRAINT domains_hostname_check CHECK ((hostname = lower(hostname))),
    CONSTRAINT domains_hostname_check1 CHECK (((hostname = btrim(hostname)) AND (hostname <> ''::text))),
    CONSTRAINT domains_hostname_check2 CHECK ((hostname !~~ '%://%'::text)),
    CONSTRAINT domains_hostname_check3 CHECK ((hostname !~~ '%:%'::text)),
    CONSTRAINT domains_hostname_check4 CHECK (("right"(hostname, 1) <> '.'::text))
);


--
-- Name: material_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT material_sections_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 200))),
    CONSTRAINT material_sections_slug_check CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text))
);


--
-- Name: materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    section_id uuid NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    content jsonb,
    cover_media_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT materials_check CHECK (((status <> 'published'::text) OR (published_at IS NOT NULL))),
    CONSTRAINT materials_content_check CHECK (((content IS NULL) OR (jsonb_typeof(content) = 'object'::text))),
    CONSTRAINT materials_slug_check CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT materials_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


--
-- Name: media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media (
    id uuid NOT NULL,
    site_id uuid NOT NULL,
    filename text NOT NULL,
    mime_type text NOT NULL,
    size bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_mime_type_check CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text]))),
    CONSTRAINT media_size_check CHECK (((size > 0) AND (size <= 10485760)))
);


--
-- Name: pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    path text NOT NULL,
    title text NOT NULL,
    content jsonb DEFAULT '[]'::jsonb NOT NULL,
    deleted_at timestamp with time zone,
    page_type text DEFAULT 'standard'::text NOT NULL,
    data_source text,
    detail_parent_id uuid,
    route_param text,
    material_section_id uuid,
    CONSTRAINT pages_content_check CHECK ((jsonb_typeof(content) = 'array'::text)),
    CONSTRAINT pages_page_type_check CHECK ((page_type = ANY (ARRAY['standard'::text, 'list'::text, 'detail'::text]))),
    CONSTRAINT pages_type_fields_check CHECK ((((page_type = 'standard'::text) AND (data_source IS NULL) AND (material_section_id IS NULL) AND (detail_parent_id IS NULL) AND (route_param IS NULL)) OR ((page_type = 'list'::text) AND (data_source = ANY (ARRAY['materials'::text, 'products'::text, 'reviews'::text])) AND (((data_source = 'materials'::text) AND (material_section_id IS NOT NULL)) OR ((data_source = ANY (ARRAY['products'::text, 'reviews'::text])) AND (material_section_id IS NULL))) AND (detail_parent_id IS NULL) AND (route_param IS NULL)) OR ((page_type = 'detail'::text) AND (data_source IS NULL) AND (material_section_id IS NULL) AND (detail_parent_id IS NOT NULL) AND (route_param ~ '^[A-Za-z][A-Za-z0-9_]*$'::text))))
);


--
-- Name: product_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    category_id uuid,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    media_id uuid,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'published'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    type text DEFAULT 'service'::text NOT NULL,
    CONSTRAINT products_status_check CHECK ((status = ANY (ARRAY['published'::text, 'hidden'::text]))),
    CONSTRAINT products_type_check CHECK ((type = ANY (ARRAY['service'::text, 'goods'::text])))
);


--
-- Name: redirects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redirects (
    site_id uuid NOT NULL,
    from_path text NOT NULL,
    page_id uuid NOT NULL
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    author_name text NOT NULL,
    author_subtitle text,
    text text NOT NULL,
    media_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    moderated_at timestamp with time zone,
    review_date date DEFAULT CURRENT_DATE NOT NULL,
    CONSTRAINT reviews_author_name_check CHECK (((char_length(author_name) >= 1) AND (char_length(author_name) <= 200))),
    CONSTRAINT reviews_author_subtitle_check CHECK (((author_subtitle IS NULL) OR ((char_length(author_subtitle) >= 1) AND (char_length(author_subtitle) <= 300)))),
    CONSTRAINT reviews_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'published'::text, 'rejected'::text]))),
    CONSTRAINT reviews_text_check CHECK (((char_length(text) >= 1) AND (char_length(text) <= 5000)))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: site_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_memberships (
    site_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.site_role NOT NULL
);


--
-- Name: site_payment_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_payment_integrations (
    site_id uuid NOT NULL,
    provider text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT false NOT NULL
);


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    theme_id text DEFAULT 'calm'::text NOT NULL,
    theme_mode text DEFAULT 'light'::text NOT NULL,
    theme_overrides jsonb DEFAULT '{}'::jsonb NOT NULL,
    contact_settings jsonb DEFAULT '{"hours": "", "phone": "", "address": "", "socials": [], "latitude": null, "longitude": null}'::jsonb NOT NULL,
    CONSTRAINT sites_contact_settings_check CHECK ((jsonb_typeof(contact_settings) = 'object'::text)),
    CONSTRAINT sites_theme_mode_check CHECK ((theme_mode = ANY (ARRAY['light'::text, 'dark'::text, 'system'::text]))),
    CONSTRAINT sites_theme_overrides_check CHECK ((jsonb_typeof(theme_overrides) = 'object'::text))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    is_superadmin boolean DEFAULT false NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'blocked'::text])))
);


--
-- Name: domains domains_hostname_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_hostname_key UNIQUE (hostname);


--
-- Name: domains domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_pkey PRIMARY KEY (id);


--
-- Name: material_sections material_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_sections
    ADD CONSTRAINT material_sections_pkey PRIMARY KEY (id);


--
-- Name: material_sections material_sections_site_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_sections
    ADD CONSTRAINT material_sections_site_id_id_key UNIQUE (site_id, id);


--
-- Name: material_sections material_sections_site_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_sections
    ADD CONSTRAINT material_sections_site_id_slug_key UNIQUE (site_id, slug);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: materials materials_site_id_section_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_site_id_section_id_slug_key UNIQUE (site_id, section_id, slug);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: media media_site_id_filename_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_site_id_filename_key UNIQUE (site_id, filename);


--
-- Name: pages pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);


--
-- Name: pages pages_site_id_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_site_id_id_unique UNIQUE (site_id, id);


--
-- Name: pages pages_site_id_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_site_id_path_key UNIQUE (site_id, path);


--
-- Name: product_categories product_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);


--
-- Name: product_categories product_categories_site_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_site_id_id_key UNIQUE (site_id, id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: redirects redirects_site_id_from_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redirects
    ADD CONSTRAINT redirects_site_id_from_path_key UNIQUE (site_id, from_path);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: site_memberships site_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_memberships
    ADD CONSTRAINT site_memberships_pkey PRIMARY KEY (site_id, user_id);


--
-- Name: site_payment_integrations site_payment_integrations_site_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_payment_integrations
    ADD CONSTRAINT site_payment_integrations_site_id_provider_key UNIQUE (site_id, provider);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: sites sites_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_slug_key UNIQUE (slug);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: material_sections_site_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX material_sections_site_order_idx ON public.material_sections USING btree (site_id, sort_order, id);


--
-- Name: materials_section_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX materials_section_published_idx ON public.materials USING btree (site_id, section_id, published_at DESC, slug) WHERE (status = 'published'::text);


--
-- Name: pages_one_active_material_list_per_section; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pages_one_active_material_list_per_section ON public.pages USING btree (site_id, material_section_id) WHERE ((page_type = 'list'::text) AND (data_source = 'materials'::text) AND (material_section_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: pages_one_detail_template_per_list; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pages_one_detail_template_per_list ON public.pages USING btree (site_id, detail_parent_id) WHERE (page_type = 'detail'::text);


--
-- Name: product_categories_site_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_categories_site_order_idx ON public.product_categories USING btree (site_id, sort_order, id);


--
-- Name: products_site_category_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_site_category_order_idx ON public.products USING btree (site_id, category_id, sort_order, id);


--
-- Name: reviews_site_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reviews_site_status_created_idx ON public.reviews USING btree (site_id, status, created_at DESC, id);


--
-- Name: site_memberships_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX site_memberships_user_id_idx ON public.site_memberships USING btree (user_id);


--
-- Name: site_payment_integrations_one_active_per_site; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX site_payment_integrations_one_active_per_site ON public.site_payment_integrations USING btree (site_id) WHERE is_active;


--
-- Name: users_email_lower_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_lower_idx ON public.users USING btree (lower(email));


--
-- Name: domains domains_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: material_sections material_sections_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_sections
    ADD CONSTRAINT material_sections_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: materials materials_cover_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_cover_media_id_fkey FOREIGN KEY (cover_media_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: materials materials_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: materials materials_site_id_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_site_id_section_id_fkey FOREIGN KEY (site_id, section_id) REFERENCES public.material_sections(site_id, id) ON DELETE RESTRICT;


--
-- Name: media media_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: pages pages_detail_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_detail_parent_fk FOREIGN KEY (site_id, detail_parent_id) REFERENCES public.pages(site_id, id);


--
-- Name: pages pages_material_section_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_material_section_fkey FOREIGN KEY (site_id, material_section_id) REFERENCES public.material_sections(site_id, id) ON DELETE RESTRICT;


--
-- Name: pages pages_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: product_categories product_categories_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;


--
-- Name: products products_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: products products_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: redirects redirects_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redirects
    ADD CONSTRAINT redirects_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: redirects redirects_site_id_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redirects
    ADD CONSTRAINT redirects_site_id_page_id_fkey FOREIGN KEY (site_id, page_id) REFERENCES public.pages(site_id, id);


--
-- Name: reviews reviews_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: site_memberships site_memberships_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_memberships
    ADD CONSTRAINT site_memberships_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: site_memberships site_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_memberships
    ADD CONSTRAINT site_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: site_payment_integrations site_payment_integrations_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_payment_integrations
    ADD CONSTRAINT site_payment_integrations_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('202610130001'),
    ('202610150001'),
    ('202610150002'),
    ('202610160001'),
    ('202610210001'),
    ('202610250001'),
    ('202610270001'),
    ('202610270002'),
    ('202610280001'),
    ('202610290001'),
    ('202610290002'),
    ('202610300001'),
    ('202610310001'),
    ('202611010001'),
    ('202611010002'),
    ('202611010003'),
    ('202611020000'),
    ('202611020001');
