import { Context } from 'moleculer';
import { MetaSession } from '../types';

export const VISIBLE_TO_CREATOR_OR_ADMIN_SCOPE = {
  names: ['visibleToCreatorOrAdminScope'],
  scopes: {
    visibleToCreatorOrAdminScope(query: any, ctx: Context<null, MetaSession>) {
      const session = ctx.meta.session;
      if (!session?.user?.id) {
        return { ...query, createdBy: -1 };
      }

      const userId = session.user.id;
      const activeOrgCode = session.activeOrgCode ?? null;

      if (activeOrgCode != null && String(activeOrgCode).trim() !== '') {
        // Only rows I created for the selected org
        return { ...query, createdBy: userId, companyCode: activeOrgCode };
      }

      // No active org, all rows I created with "Fizinis asmuo"
      return { ...query, createdBy: userId, companyCode: null };
    },
  },
};
