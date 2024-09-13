import { Context } from 'moleculer';
import { UserAuthMeta } from '../services/api.service';

export const VISIBLE_TO_CREATOR_OR_ADMIN_SCOPE = {
  names: ['visibleToCreatorOrAdminScope'],
  scopes: {
    visibleToCreatorOrAdminScope(query: any, ctx: Context<null, UserAuthMeta>, params: any) {
      const { user, profile } = ctx?.meta?.session || {};
      if (!user?.id) return query;

      if (profile?.id) {
        return { ...query, tenant: profile.id };
      } else {
        const createdByUserQuery = {
          createdBy: user?.id,
          tenant: { $exists: false },
        };
        return { ...query, ...createdByUserQuery };
      }

      return query;
    },
  },
};
