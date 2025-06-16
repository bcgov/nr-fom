const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class FeatureViewWithFomName1749920271653 {

    async up(queryRunner) {
        await queryRunner.query(`
          drop view if exists app_fom.spatial_feature;
          create view app_fom.spatial_feature as 
            select o.cut_block_id as feature_id, 'cut_block' as feature_type,
            p.project_id, p.name as fom_name, p.forest_client_number, p.workflow_state_code,
            s.submission_type_code,  
            o.create_timestamp,
            o.name, ST_AsGeoJson(ST_Transform(o.geometry, 4326)) as geojson, o.planned_development_date, o.planned_area_ha, 0.0 as planned_length_km,
            ST_AsGeoJson(ST_Transform(ST_centroid(o.geometry), 4326)) as centroid
            from app_fom.cut_block o
            inner join app_fom.submission s on o.submission_id = s.submission_id
            inner join app_fom.project p on s.project_id = p.project_id
          union       
            select o.retention_area_id as feature_id, 'retention_area' as feature_type,
            p.project_id, p.name as fom_name, p.forest_client_number, p.workflow_state_code,
            s.submission_type_code,  
            o.create_timestamp,
            null as name, ST_AsGeoJson(ST_Transform(o.geometry, 4326)) as geojson, null as planned_development_date, o.planned_area_ha, 0.0 as planned_length_km,
            ST_AsGeoJson(ST_Transform(ST_centroid(o.geometry), 4326)) as centroid
            from app_fom.retention_area o
            inner join app_fom.submission s on o.submission_id = s.submission_id
            inner join app_fom.project p on s.project_id = p.project_id
          union
            select o.road_section_id as feature_id, 'road_section' as feature_type,
            p.project_id, p.name as fom_name, p.forest_client_number, p.workflow_state_code,
            s.submission_type_code,  
            o.create_timestamp,
            o.name, ST_AsGeoJson(ST_Transform(o.geometry, 4326)) as geojson, o.planned_development_date, null as planned_area_ha, o.planned_length_km,
            ST_AsGeoJson(ST_Transform(ST_centroid(o.geometry), 4326)) as centroid
            from app_fom.road_section o
            inner join app_fom.submission s on o.submission_id = s.submission_id
            inner join app_fom.project p on s.project_id = p.project_id
          ;
       `);    
    }

    async down(queryRunner) {
        // Previous definition
        await queryRunner.query(`
        drop view if exists app_fom.spatial_feature;
        create view app_fom.spatial_feature as 
          select o.cut_block_id as feature_id, 'cut_block' as feature_type,
          p.project_id, p.forest_client_number, p.workflow_state_code,
          s.submission_type_code,  
          o.create_timestamp,
          o.name, ST_AsGeoJson(ST_Transform(o.geometry, 4326)) as geojson, o.planned_development_date, o.planned_area_ha, 0.0 as planned_length_km,
          ST_AsGeoJson(ST_Transform(ST_centroid(o.geometry), 4326)) as centroid
          from app_fom.cut_block o
          inner join app_fom.submission s on o.submission_id = s.submission_id
          inner join app_fom.project p on s.project_id = p.project_id
        union       
          select o.retention_area_id as feature_id, 'retention_area' as feature_type,
          p.project_id, p.forest_client_number, p.workflow_state_code,
          s.submission_type_code,  
          o.create_timestamp,
          null as name, ST_AsGeoJson(ST_Transform(o.geometry, 4326)) as geojson, null as planned_development_date, o.planned_area_ha, 0.0 as planned_length_km,
          ST_AsGeoJson(ST_Transform(ST_centroid(o.geometry), 4326)) as centroid
          from app_fom.retention_area o
          inner join app_fom.submission s on o.submission_id = s.submission_id
          inner join app_fom.project p on s.project_id = p.project_id
        union
          select o.road_section_id as feature_id, 'road_section' as feature_type,
          p.project_id, p.forest_client_number, p.workflow_state_code,
          s.submission_type_code,  
          o.create_timestamp,
          o.name, ST_AsGeoJson(ST_Transform(o.geometry, 4326)) as geojson, o.planned_development_date, null as planned_area_ha, o.planned_length_km,
          ST_AsGeoJson(ST_Transform(ST_centroid(o.geometry), 4326)) as centroid
          from app_fom.road_section o
          inner join app_fom.submission s on o.submission_id = s.submission_id
          inner join app_fom.project p on s.project_id = p.project_id
        ;
        `);         
    }

}
