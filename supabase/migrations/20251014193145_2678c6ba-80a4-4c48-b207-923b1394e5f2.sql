-- Adicionar campo para configurar bloqueios intercalados em serviços
ALTER TABLE public.services 
ADD COLUMN interleaved_blocks jsonb DEFAULT NULL;

COMMENT ON COLUMN public.services.interleaved_blocks IS 'Configuração de bloqueios intercalados para serviços com períodos de espera. Exemplo: [{"start_min": 0, "duration_min": 30, "blocked": true}, {"start_min": 30, "duration_min": 30, "blocked": false}]';