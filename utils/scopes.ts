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
        // Only rows created for the selected org
        return { ...query, companyCode: activeOrgCode };
      }

      // No active org, all rows I created with "Fizinis asmuo"
      return { ...query, createdBy: userId, companyCode: null };
    },
  },
};

export const VISIBLE_TO_CREATOR_OR_ADMIN_SCOPE_VKO = {
  names: ['visibleToCreatorOrAdminScopeVko'],
  scopes: {
    visibleToCreatorOrAdminScopeVko(query: any, ctx: Context<null, MetaSession>) {
      const session = ctx.meta.session;
      if (!session?.user?.id) {
        return { ...query, sprenInCreatedBy: -1 };
      }

      const userId = session.user.id;
      const userAK = session.ak ?? null;
      const activeOrgCode = session.activeOrgCode ?? null;
      const activeOrgCodeStr = activeOrgCode != null ? String(activeOrgCode).trim() : '';
      const userAKStr = userAK != null ? String(userAK).trim() : '';

      // 1. JA:
      if (activeOrgCodeStr.length === 9) {
        return { ...query, sprenParentId: activeOrgCode };
      }

      // 2. FA:
      if (userAKStr.length === 11) {
        return { ...query, sprenParentId: userAK };
      }

      // 3. FA fallback
      return { ...query, sprenInCreatedBy: userId, sprenParentId: null };
    },
  },
};
