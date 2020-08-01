export class DAO {
  /**
   * @returns {Promise<DAO>}
   */
  static async getDAOForPlatform() {
    if ('FAUNA_DB_KEY' in globalThis) {
      return import(/* webpackMode: "eager" */ './fauna-dao').then(module => new module.FaunaDAO())
    } else if ('IndexedDB' in self) {
      return import(/* webpackMode: "eager" */ './idb-dao').then(module => new module.IdbDAO())
    }
    throw new Error()
  }

  /**
   * @returns {Promise<Response>}
   */
  async init() { throw new Error() }

  /**
   * @param {object} param0 
   * @param {Request} request 
   * @returns {Promise<Response>}
   */
  async updateClaps(param0, request) { throw new Error() }

  /**
   * @param {object} param0
   * @param {Request} request 
   * @returns {Promise<Response>}
   */
  async getClaps(param0, request) { throw new Error() }
}
