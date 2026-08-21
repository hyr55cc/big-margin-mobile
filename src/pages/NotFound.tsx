import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { Btn, Empty } from '@/components/ui';

export default function NotFound() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <Empty
      icon="search"
      title="404"
      desc={t('g.noResultsHint')}
      action={
        <Btn variant="primary" onClick={() => navigate('/app')}>
          {t('nav.dashboard')}
        </Btn>
      }
    />
  );
}
